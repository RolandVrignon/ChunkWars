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

// Helper to process arrays in chunks
async function getChunks(
  strategy: string,
  file: File,
  chunkSize: number,
  overlap: number
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
    case "recursive":
    default:
      console.log("Using Recursive Overlap strategy");
      textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: overlap,
      });
      break;
  }

  let fileContent: string;
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

  const documents = await textSplitter.createDocuments([fileContent]);
  return documents.map((doc: { pageContent: string }) => ({ chunk: doc.pageContent }));
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

    const safeProjects = projects.map(project => ({
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectName = formData.get("projectName") as string;
    const model = formData.get("model") as EmbeddingModel;
    const strategy = formData.get("strategy") as string | null;

    if (!file || !projectName || !model) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: projectName,
        embedding_model: model,
        userId: session.user.id,
      },
    });

    const readableStream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const sendEvent = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            sendEvent({ type: 'status', message: 'Extracting text...' });

            let rows: { [key: string]: string }[] = [];
            if (strategy) {
                const chunkSize = Number(formData.get("chunkSize"));
                const overlap = Number(formData.get("overlap"));
                sendEvent({ type: 'status', message: 'Chunking document... This may take a moment.' });
                rows = await getChunks(strategy, file, chunkSize, overlap);
            } else {
                 const fileContent = await file.text();
                 const parsedCsv = Papa.parse(fileContent, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header) => header.toLowerCase(),
                });
                rows = parsedCsv.data as { [key: string]: string }[];
            }

            sendEvent({ type: 'status', message: `Saving ${rows.length} chunks...` });

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
                 sendEvent({ type: 'chunk', data: { ...newDocument, id: newDocument.id.toString(), projectId: newDocument.projectId.toString()} });
            }

            sendEvent({ type: 'done', projectId: project.id.toString() });
            controller.close();
        }
    });

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error) {
    console.error("[PROJECT_CREATION_ERROR]", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return new NextResponse("A project with this name already exists.", {
        status: 409,
      });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}