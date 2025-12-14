// Embedding utilities for semantic search using OpenRouter
import { db } from "@/lib/db/client";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // OpenRouter supports OpenAI embedding models

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY not set, skipping embedding generation");
    return [];
  }

  if (!text || text.trim().length === 0) {
    console.warn("Empty text provided for embedding generation");
    return [];
  }

  try {
    console.log("Generating embedding for text:", text.substring(0, 50) + "...");
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Prod-Up",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter embedding API error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    
    if (!embedding || !Array.isArray(embedding)) {
      console.error("Invalid embedding response:", data);
      return [];
    }

    console.log(`Generated embedding with ${embedding.length} dimensions`);
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}

export async function findSimilarTasks(
  userId: string,
  queryEmbedding: number[],
  limit: number = 10
): Promise<string[]> {
  if (queryEmbedding.length === 0) {
    return [];
  }

  try {
    // Convert array to pgvector format: '[1,2,3]'::vector
    const vectorString = `[${queryEmbedding.join(',')}]`;
    
    // Use pgvector cosine distance (<->) to find similar tasks
    // We also filter by userId to only return tasks for the current user
    // Only return tasks that have embeddings (ignore tasks without embeddings)
    const result = await db.query(
      `SELECT 
        te.task_id,
        1 - (te.embedding <=> $1::vector) as similarity
      FROM task_embeddings te
      INNER JOIN tasks t ON t.id = te.task_id
      WHERE t.user_id = $2
        AND te.embedding IS NOT NULL
      ORDER BY te.embedding <=> $1::vector
      LIMIT $3`,
      [vectorString, userId, limit]
    );

    return result.rows.map((row: any) => row.task_id);
  } catch (error) {
    console.error("Error finding similar tasks:", error);
    return [];
  }
}
