CREATE TABLE "storefront_banners" (
  "id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "title_ar" VARCHAR(180) NOT NULL,
  "subtitle" VARCHAR(320),
  "subtitle_ar" VARCHAR(320),
  "image_url" VARCHAR(2048) NOT NULL,
  "href" VARCHAR(512),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "storefront_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "storefront_banners_is_active_sort_order_starts_at_ends_at_idx"
  ON "storefront_banners"("is_active", "sort_order", "starts_at", "ends_at");

ALTER TABLE "promotions"
  ADD COLUMN "name_ar" VARCHAR(160) NOT NULL DEFAULT '',
  ADD COLUMN "description_ar" VARCHAR(500);
