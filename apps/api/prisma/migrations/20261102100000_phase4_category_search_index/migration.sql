CREATE INDEX "categories_name_search_trgm_idx"
  ON "categories" USING GIN (normalize_arabic_search("name") gin_trgm_ops);
