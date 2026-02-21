-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add searchEmbedding column to Service table
ALTER TABLE "Service" ADD COLUMN "searchEmbedding" vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS "Service_searchEmbedding_idx" ON "Service" USING hnsw ("searchEmbedding" vector_cosine_ops);
