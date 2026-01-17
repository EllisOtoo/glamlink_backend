-- GIN trigram indexes for fast similarity and prefix searches
-- These indexes accelerate both the % (trigram similarity) operator 
-- and ILIKE prefix matching using the same gin_trgm_ops operator class

CREATE INDEX IF NOT EXISTS idx_service_name_gin_trgm 
ON "Service" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendor_business_name_gin_trgm 
ON "Vendor" USING gin ("businessName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_category_name_gin_trgm 
ON "Category" USING gin (name gin_trgm_ops);
