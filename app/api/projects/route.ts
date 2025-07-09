import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Papa from "papaparse";
import { OpenAI } from "openai";
import { EmbeddingModel } from "@prisma/client";

const apiKey = process.env.OPENAI_API_KEY ?? "";

const openai = new OpenAI({
  apiKey: apiKey,
}); 

// Helper to process arrays in chunks
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
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

    if (!file || !projectName || !model) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const fileContent = await file.text();
    const parsedCsv = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.toLowerCase(),
    });

    const headers = parsedCsv.meta.fields;
    if (!headers || !headers.includes('chunk')) {
      return new NextResponse("Le fichier CSV doit contenir une colonne 'chunk'.", { status: 400 });
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

        const rows = parsedCsv.data as { [key: string]: string }[];
        const totalRows = rows.length;
        let processedCount = 0;

        sendEvent({ type: 'start', total: totalRows });

        const rowChunks = chunkArray(rows, 15);

        for (const chunk of rowChunks) {
          await Promise.all(chunk.map(async (row) => {
            const { chunk: content, ...metadata } = row;
            if (!content) return;

            const modelName = model.replace('openai_', '').replace(/_/g, '-');
            const embeddingOptions: { model: string; input: string; dimensions?: number } = {
              model: modelName,
              input: content,
            };

            if (model === 'openai_text_embedding_3_large') {
              embeddingOptions.dimensions = 1536;
            }

            const embeddingResponse = await openai.embeddings.create(embeddingOptions);
            const embedding = embeddingResponse.data[0].embedding;

            await prisma.$executeRaw`
              INSERT INTO documents (content, metadata, project_id, embedding)
              VALUES (${content}, ${JSON.stringify(metadata)}::jsonb, ${project.id}, ${`[${embedding.join(',')}]`}::vector)
            `;
          }));

          processedCount += chunk.length;
          sendEvent({ type: 'progress', processed: processedCount, total: totalRows });
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
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return new NextResponse("Un projet avec ce nom existe déjà.", { status: 409 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}