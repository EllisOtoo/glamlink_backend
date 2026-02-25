# Post-Mortem: AI Search Results Missing Newly Created Services

## Issue Description
Newly created services by vendors (e.g., "Hair Fading") were not appearing in the AI Natural Language Search results, despite the backend search functionality and vector database (`pgvector`) behaving correctly for older services. 

## Root Cause
The `searchEmbedding` column on the `Service` model is defined as an `Unsupported("vector(1536)")` type in Prisma, which represents a PostgreSQL `pgvector` extension column.

Because this type is structurally unsupported by Prisma Client, it must be interacted with using raw SQL queries.

In the original `ServicesService` implementation within `src/services/services.service.ts`, the logic correctly saved the standard Prisma fields when `.create()` or `.update()` was called on a `Service`. However, the logic to independently generate the OpenAI embeddings (via `EmbeddingService`) and explicitly save that embedding via a raw SQL `UPDATE` statement was completely omitted. Thus, all newly created services had a `null` value for their `searchEmbedding` column, making them invisible to the vector similarity search query.

Furthermore, fixing this issue in the code initially didn't reflect on the running development server due to a localized macOS file permissions error on the `node_modules` directory (`EPERM: operation not permitted, lstat ... /node_modules`) which broke the application's hot-reloading pipeline, meaning tests done immediately after applying the fix appeared as if the fix did not work.

## Solution

1. **Injected EmbeddingService**: Included the `AiSearchModule` into the `ServicesModule` and injected the `EmbeddingService` into the `ServicesService`.
2. **Post-Create Embedding Generation**: Immediately after calling `this.prisma.service.create()`, the `EmbeddingService` generates the vector based on the service's name, description, and included items.
3. **Post-Update Embedding Generation**: Immediately after calling `this.prisma.service.update()`, IF the name/description/includes were mutated, a new embedding is regenerated.
4. **Raw SQL Execution**: Both of these operations save the vector to the database using `this.prisma.$executeRawUnsafe()`, executing an `UPDATE "Service" SET "searchEmbedding" = ... WHERE id = ...` statement to bypass Prisma's type limitations. 
5. **Fixed Build Cache**: Restarted the dev server using `sudo chown` to reset the folder bindings that broke hot-reloading.
6. **Backfill Script**: A script was provided as `backfill-embeddings.ts` that can be run on-demand to scan for any instances of a `Service` where `searchEmbedding IS NULL` and patch them automatically.
