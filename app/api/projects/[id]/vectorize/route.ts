import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { OpenAI } from "openai";

const apiKey = process.env.OPENAI_API_KEY ?? "";
const openai = new OpenAI({ apiKey });

// Helper to process arrays in chunks
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Not authenticated", { status: 401 });
    }

    const projectId = Number(params.id);

    // Verify user owns the project
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id }
    });

    if (!project) {
        return new NextResponse("Project not found or you do not have access", { status: 404 });
    }

    // Set status to PROCESSING
    await prisma.project.update({
        where: { id: projectId },
        data: { status: 'PROCESSING' }
    });

    const documents = await prisma.document.findMany({
      where: {
        projectId: projectId,
        embedding: { isEmpty: true }, // Prisma specific: find where vector is null/empty
      },
    });

    if (documents.length === 0) {
        return NextResponse.json({ message: "All documents are already vectorized." });
    }

    // Process in batches
    const documentChunks = chunkArray(documents, 50); // Batch size of 50

    for (const batch of documentChunks) {
        const contents = batch.map(doc => doc.content);
        const model = project.embedding_model;

        const modelName = model.replace('openai_', '').replace(/_/g, '-');
        const embeddingOptions: { model: string; input: string | string[]; dimensions?: number } = {
            model: modelName,
            input: contents,
        };

        if (model === 'openai_text_embedding_3_large') {
            embeddingOptions.dimensions = 1536;
        }

        const embeddingResponse = await openai.embeddings.create(embeddingOptions);

        // Update documents with their embeddings
        for (let i = 0; i < batch.length; i++) {
            const doc = batch[i];
            const embedding = embeddingResponse.data[i].embedding;
            await prisma.$executeRaw`
                UPDATE documents
                SET embedding = ${`[${embedding.join(',')}]`}::vector
                WHERE id = ${doc.id}
            `;
        }
    }

    // Set status to COMPLETED
    await prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' }
    });

    return NextResponse.json({
      message: `${documents.length} documents vectorized successfully.`,
    });

  } catch (error) {
    console.error("[VECTORIZATION_ERROR]", error);
    // Optionally, revert status to PENDING on error
    await prisma.project.update({
        where: { id: Number(params.id) },
        data: { status: 'PENDING' }
    });
    return new NextResponse("Internal Server Error during vectorization.", { status: 500 });
  }
}