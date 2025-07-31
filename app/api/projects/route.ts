import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Papa from "papaparse";
import { EmbeddingModel } from "@prisma/client";
import {
  RecursiveCharacterTextSplitter,
  CharacterTextSplitter,
} from "langchain/text_splitter";
import pdf from "pdf-parse";
import { Mistral } from "@mistralai/mistralai";
import { responseFormatFromZodObject } from '@mistralai/mistralai/extra/structChat.js';
import { z } from 'zod';

// BBOX Annotation response format
const ImageSchema = z.object({
  image_type: z.string(),
  short_description: z.string(),
  summary: z.string(),
});

// Document Annotation response format
const DocumentSchema = z.object({
  language: z.string(),
  chapter_titles: z.array(z.string()),
  urls: z.array(z.string()),
});

// --- START: Mistral OCR Specific Functions ---

interface OcrPage {
  markdown: string;
  images?: Array<{
    id: string;
    topLeftX: number | null;
    topLeftY: number | null;
    bottomRightX: number | null;
    bottomRightY: number | null;
    imageBase64: string;
    imageAnnotation: string;
  }>;
}

// Function to enrich images in markdown with annotations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enrichImagesInMarkdown(pages: any[]): OcrPage[] {
  return pages.map(page => {
    let enrichedMarkdown = page.markdown;

    if (page.images) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      page.images.forEach((image: any) => {
        try {
          // Parse the image annotation JSON
          const annotation = JSON.parse(image.imageAnnotation);
          const { short_description, summary } = annotation;

          // Find and replace the image reference in markdown
          // Pattern: ![img-id](img-id) -> ![short_description](img-id) [summary]
          const originalPattern = new RegExp(`!\\[${image.id}\\]\\(${image.id}\\)`, 'g');
          const replacement = `![${short_description}](${image.id}) [${summary}]`;

          enrichedMarkdown = enrichedMarkdown.replace(originalPattern, replacement);
        } catch (error) {
          console.log("Error parsing image annotation:", error);
          // Keep original format if annotation parsing fails
        }
      });
    }

    return {
      ...page,
      markdown: enrichedMarkdown
    };
  });
}

// Helper function to get number of pages from PDF URL
async function getNumberOfPagesFromUrl(documentUrl: string): Promise<number> {
  try {
    console.log("Fetching PDF to determine number of pages...");
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const data = await pdf(buffer);

    console.log(`PDF has ${data.numpages} pages`);
    return data.numpages;
  } catch (error) {
    console.log("Error getting number of pages, using default:", error);
    return 8; // Fallback to default
  }
}

async function performMistralOcr(documentUrl: string, pages?: number): Promise<{
  pages: OcrPage[];
  documentAnnotation?: string | null;
}> {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;

    const client = new Mistral({ apiKey: apiKey });

    // If no pages specified, try to get the actual number of pages
    let numberOfPages = pages;
    if (!numberOfPages) {
      numberOfPages = await getNumberOfPagesFromUrl(documentUrl);
    }

    console.log(`Processing ${numberOfPages} pages with Mistral OCR`);

    // Check if document has more than 8 pages (Mistral OCR limitation for document_annotations)
    const useDocumentAnnotations = numberOfPages <= 8;

    if (!useDocumentAnnotations) {
      console.log(`Document has ${numberOfPages} pages (> 8), disabling document_annotations to avoid API error`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestConfig: any = {
      model: "mistral-ocr-latest",
      pages: Array.from({ length: numberOfPages }, (_, i) => i),
      document: {
        type: "document_url" as const,
        documentUrl: documentUrl
      },
      bboxAnnotationFormat: responseFormatFromZodObject(ImageSchema),
      includeImageBase64: true,
    };

    // Only add documentAnnotationFormat for documents with ≤ 8 pages
    if (useDocumentAnnotations) {
      requestConfig.documentAnnotationFormat = responseFormatFromZodObject(DocumentSchema);
    }

    const response = await client.ocr.process(requestConfig);

    console.log("Mistral OCR API response:", response);

    console.log("AAAAAAAAAAAAAAAAAAAAAAHHHHHHHHHHH", JSON.stringify(response, null, 2));

    // Enrich images in markdown before returning
    const enrichedPages = enrichImagesInMarkdown(response.pages);

    return {
      pages: enrichedPages,
      documentAnnotation: useDocumentAnnotations ? response.documentAnnotation : null
    };
  } catch (error) {
    console.log("Error in Mistral OCR:", error);
    throw error;
  }
}

function createContextualizedChunks(
  projectName: string,
  ocrPages: OcrPage[],
  documentAnnotation?: string | null
): { chunk: string }[] {
  // Parse document annotation to get structure info
  let chapterTitles: string[] = [];
  let documentLanguage = '';
  let hasDocumentStructure = false;

  if (documentAnnotation) {
    try {
      const annotation = JSON.parse(documentAnnotation);
      chapterTitles = annotation.chapter_titles || [];
      documentLanguage = annotation.language || '';
      hasDocumentStructure = chapterTitles.length > 0;
      console.log('Document structure detected:', {
        language: documentLanguage,
        chapters: chapterTitles.length,
        hasStructure: hasDocumentStructure
      });
    } catch (error) {
      console.log("Error parsing document annotation:", error);
    }
  } else {
    console.log('No document annotation available (document > 8 pages), using basic chunking strategy');
  }

  // Join all pages together (images are already enriched)
  const fullContent = ocrPages.map(page => page.markdown).join('\n');
  console.log('fullContent:', fullContent);
  const lines = fullContent.split('\n');

  const chunks: { chunk: string }[] = [];

  // Parse structure: find all headings with their positions
  interface Heading {
    level: number;
    title: string;
    cleanTitle: string;
    lineIndex: number;
    fullPath: string[];
    chapterIndex?: number; // Index in the chapter_titles array
  }

  const headings: Heading[] = [];
  const headingStack: string[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const titleMatch = trimmedLine.match(/^(#+)\s+(.*)$/);

    if (titleMatch) {
      const level = titleMatch[1].length;
      const title = titleMatch[2];
      const cleanTitle = title;

      // Try to match with chapter titles from documentAnnotation
      const chapterIndex = chapterTitles.findIndex(chapterTitle =>
        chapterTitle.toLowerCase().includes(cleanTitle.toLowerCase()) ||
        cleanTitle.toLowerCase().includes(chapterTitle.toLowerCase())
      );

      // Update heading stack for hierarchy
      headingStack.length = level - 1;
      headingStack[level - 1] = cleanTitle;

      headings.push({
        level,
        title: trimmedLine,
        cleanTitle,
        lineIndex: index,
        fullPath: [...headingStack],
        chapterIndex: chapterIndex >= 0 ? chapterIndex : undefined
      });
    }
  });

  // Build hierarchical context for each heading
  const buildHierarchicalContext = (heading: Heading): string => {
    let context = '';

    // Add hierarchical path only
    const hierarchicalPath = heading.fullPath.join(' > ');
    if (hierarchicalPath) {
      context += `Section Path: ${hierarchicalPath}\n`;
    }

    return context;
  };

  // Process content between headings
  for (let i = 0; i < headings.length; i++) {
    const currentHeading = headings[i];
    const nextHeading = headings[i + 1];

    // Find content between this heading and the next
    const startLine = currentHeading.lineIndex + 1;
    const endLine = nextHeading ? nextHeading.lineIndex : lines.length;

    // Extract content lines (non-heading)
    const contentLines = lines.slice(startLine, endLine)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.match(/^#+\s+/);
      });

    // Check if this heading has sub-headings
    const hasSubHeadings = nextHeading && nextHeading.level > currentHeading.level;

    if (hasSubHeadings) {
      // Split content: before first sub-heading and after last sub-heading
      const firstSubHeadingIndex = headings.findIndex((h, idx) =>
        idx > i && h.level > currentHeading.level
      );
      const lastSubHeadingOfSameParent = headings.findLastIndex((h, idx) =>
        idx > i && h.level > currentHeading.level &&
        h.fullPath.slice(0, currentHeading.level).join('/') === currentHeading.fullPath.join('/')
      );

      // Content before sub-headings (introduction)
      if (firstSubHeadingIndex > 0) {
        const introEndLine = headings[firstSubHeadingIndex].lineIndex;
        const introContent = lines.slice(startLine, introEndLine)
          .filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.match(/^#+\s+/);
          });

        if (introContent.length > 0) {
          const hierarchicalContext = buildHierarchicalContext(currentHeading);
          const headingPath = currentHeading.fullPath.map(title => title + '\n').join('');
          const content = introContent.join('\n').trim();
          if (content) {
            chunks.push({
              chunk: hierarchicalContext + headingPath + content
            });
          }
        }
      }

      // Content after sub-headings (conclusion)
      if (lastSubHeadingOfSameParent >= 0) {
        const conclusionStartLine = nextHeading ? nextHeading.lineIndex : lines.length;
        const conclusionContent = lines.slice(
          lastSubHeadingOfSameParent < headings.length - 1 ?
            headings[lastSubHeadingOfSameParent + 1]?.lineIndex || conclusionStartLine :
            conclusionStartLine,
          endLine
        ).filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.match(/^#+\s+/);
        });

        if (conclusionContent.length > 0) {
          const hierarchicalContext = buildHierarchicalContext(currentHeading);
          const headingPath = currentHeading.fullPath.map(title => title + '\n').join('');
          const content = conclusionContent.join('\n').trim();
          if (content) {
            chunks.push({
              chunk: hierarchicalContext + headingPath + content
            });
          }
        }
      }
    } else {
      // No sub-headings, create chunk with all content
      if (contentLines.length > 0) {
        const hierarchicalContext = buildHierarchicalContext(currentHeading);
        const headingPath = currentHeading.fullPath.map(title => title + '\n').join('');
        const content = contentLines.join('\n').trim();
        if (content) {
          chunks.push({
            chunk: hierarchicalContext + headingPath + content
          });
        }
      }
    }
  }

  return chunks.filter((c) => c.chunk.trim().length > 0);
}

// --- END: Mistral OCR Specific Functions ---

// Helper to process arrays in chunks
async function getChunks(
  strategy: string,
  file: File | null,
  chunkSize: number,
  overlap: number,
  projectName: string,
  documentUrl?: string,
  numberOfPages?: number
) {
  let textSplitter;

  switch (strategy) {
    case "simple":
      console.log("Using Simple Overlap strategy");
      textSplitter = new CharacterTextSplitter({
        chunkSize,
        chunkOverlap: overlap,
        separator: " ",
      });
      break;
    case "mistral_ocr":
      console.log("Using Mistral OCR strategy");
      if (!documentUrl) throw new Error("Document URL is required for Mistral OCR");
      // Use automatic page detection if numberOfPages is not provided or is 0
      const pagesToProcess = numberOfPages && numberOfPages > 0 ? numberOfPages : undefined;
      const { pages, documentAnnotation } = await performMistralOcr(documentUrl, pagesToProcess);
      return createContextualizedChunks(projectName, pages, documentAnnotation);
    case "recursive":
    default:
      console.log("Using Recursive Overlap strategy");
      textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: overlap,
      });
      break;
  }

  if (!file && !documentUrl) throw new Error("File or document URL is required for this chunking strategy");

  let fileContent: string;
  
  if (file) {
    // Process uploaded file
    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdf(buffer);
      console.log("--- PDF PARSE OUTPUT ---");
      console.log(data.text);
      console.log("--- END PDF PARSE OUTPUT ---");
      fileContent = data.text;
    } else {
      fileContent = await file.text();
    }
  } else if (documentUrl) {
    // Process document from URL
    console.log("Fetching document from URL:", documentUrl);
    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdf(buffer);
      console.log("--- PDF PARSE OUTPUT (from URL) ---");
      console.log(data.text);
      console.log("--- END PDF PARSE OUTPUT ---");
      fileContent = data.text;
    } else {
      fileContent = await response.text();
    }
  } else {
    throw new Error("No file or document URL provided");
  }

  const documents = await textSplitter.createDocuments([fileContent]);
  return documents.map((doc: { pageContent: string }) => ({
    chunk: doc.pageContent,
  }));
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const safeProjects = projects.map((project) => ({
      ...project,
      id: project.id.toString(),
    }));

    return NextResponse.json(safeProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Not authenticated", { status: 401 });
    }

    const userId = session.user.id; // Store the userId after verification
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectName = formData.get("projectName") as string;
    const model = formData.get("model") as EmbeddingModel;
    const strategy = formData.get("strategy") as string | null;
    const documentUrl = formData.get("documentUrl") as string | undefined;
    const numberOfPagesParam = formData.get("numberOfPages");
    const numberOfPages = numberOfPagesParam ? Number(numberOfPagesParam) : undefined;
    console.log('numberOfPages:', numberOfPages)

    if ((!file && !documentUrl) || !projectName || !model) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (data: object) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          sendEvent({ type: "status", message: "Extracting text..." });

          let rows: { [key: string]: string }[] = [];
          if (strategy) {
            const chunkSize = Number(formData.get("chunkSize"));
            const overlap = Number(formData.get("overlap"));
            sendEvent({
              type: "status",
              message: "Chunking document... This may take a moment.",
            });
            rows = await getChunks(
              strategy,
              file,
              chunkSize,
              overlap,
              projectName,
              documentUrl,
              numberOfPages
          );
        } else {
          if (!file) throw new Error("File is required for CSV upload");
          const fileContent = await file.text();
          const parsedCsv = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.toLowerCase(),
          });
          rows = parsedCsv.data as { [key: string]: string }[];
        }

        // Create project only after successful chunking/processing
        sendEvent({ type: "status", message: "Creating project..." });
        const project = await prisma.project.create({
          data: {
            name: projectName,
            embedding_model: model,
            userId, // We already checked this exists above
          },
        });

        sendEvent({
          type: "status",
          message: `Saving ${rows.length} chunks...`,
        });

        for (const row of rows) {
          const { chunk: content, ...metadata } = row;
          if (!content) continue;

          const newDocument = await prisma.document.create({
            data: {
              content,
              metadata,
              projectId: project.id,
            },
          });
          sendEvent({
            type: "chunk",
            data: {
              ...newDocument,
              id: newDocument.id.toString(),
              projectId: newDocument.projectId.toString(),
            },
          });
        }

        sendEvent({ type: "done", projectId: project.id.toString() });
        controller.close();
        
        } catch (error) {
          console.error("[STREAM_ERROR]", error);
          sendEvent({ 
            type: "error", 
            message: error instanceof Error ? error.message : "An error occurred during processing"
          });
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.log("[PROJECT_CREATION_ERROR]", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return new NextResponse("A project with this name already exists.", {
        status: 409,
      });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
