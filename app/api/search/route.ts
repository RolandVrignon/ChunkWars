import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";


const apiKey = process.env.OPENAI_API_KEY ?? "";

const openai = new OpenAI({
  apiKey: apiKey,
});

// Define a type for the raw query result to satisfy TypeScript
type DocumentWithSimilarity = {
  id: bigint;
  content: string | null;
  metadata: Prisma.JsonValue;
  similarity: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { query, projectId, matchCount } = await request.json();

    if (!query || !projectId) {
      return NextResponse.json(
        { error: "Query and projectId are required." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId), userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you do not have access." },
        { status: 404 }
      );
    }

    const modelName = project.embedding_model
      .replace(/_/g, "-")
      .replace("openai-", "");

    const embeddingOptions: { model: string; input: string; dimensions?: number } = {
      model: modelName,
      input: query,
    };

    console.log('modelName:', modelName);

    if (modelName === 'text-embedding-3-large') {
      embeddingOptions.dimensions = 1536;
    }

    console.log('embeddingOptions:', embeddingOptions);

    const embeddingResponse = await openai.embeddings.create(embeddingOptions);

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Use Prisma's raw query to perform vector search
    const documents: DocumentWithSimilarity[] = await prisma.$queryRaw`
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) as similarity
      FROM documents
      WHERE
        project_id = ${Number(projectId)} AND
        1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) > 0.1
      ORDER BY embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector
      LIMIT ${matchCount || 10}
    `;

    // Manually convert BigInt to string for serialization
    const safeDocuments = documents.map(doc => ({
      ...doc,
      id: doc.id.toString(),
    }));

    return NextResponse.json(safeDocuments);
  } catch (error) {
    console.error("[SEARCH_API_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}