CREATE TYPE "ProductType" AS ENUM ('MEDICINE', 'SUPPLEMENT', 'PERSONAL_CARE', 'MEDICAL_DEVICE', 'OTHER');

ALTER TABLE "products"
  ADD COLUMN "name_ar" VARCHAR(240),
  ADD COLUMN "active_ingredient" VARCHAR(240),
  ADD COLUMN "active_ingredient_ar" VARCHAR(240),
  ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "prescription_required" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "recent_searches" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "query" VARCHAR(240) NOT NULL,
  "last_searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recent_searches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recent_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "recent_searches_user_id_query_key" ON "recent_searches"("user_id", "query");
CREATE INDEX "recent_searches_user_id_last_searched_at_idx" ON "recent_searches"("user_id", "last_searched_at");

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION normalize_arabic_search(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(
    translate(coalesce(input, ''), 'أإآٱىةؤئ', 'اااايهوي'),
    '[ًٌٍَُِّْـٰ]',
    '',
    'g'
  ));
$$;

CREATE INDEX "products_name_search_trgm_idx"
  ON "products" USING GIN (normalize_arabic_search("name") gin_trgm_ops);
CREATE INDEX "products_name_ar_search_trgm_idx"
  ON "products" USING GIN (normalize_arabic_search("name_ar") gin_trgm_ops);
CREATE INDEX "products_ingredient_search_trgm_idx"
  ON "products" USING GIN (normalize_arabic_search("active_ingredient") gin_trgm_ops);
CREATE INDEX "products_ingredient_ar_search_trgm_idx"
  ON "products" USING GIN (normalize_arabic_search("active_ingredient_ar") gin_trgm_ops);
CREATE INDEX "brands_name_search_trgm_idx"
  ON "brands" USING GIN (normalize_arabic_search("name") gin_trgm_ops);

CREATE INDEX "products_name_fts_idx"
  ON "products" USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("name_ar", '') || ' ' || coalesce("active_ingredient", '') || ' ' || coalesce("active_ingredient_ar", '')));
