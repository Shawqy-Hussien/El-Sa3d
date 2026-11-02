-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('CUSTOMER', 'ADMIN', 'PHARMACIST', 'DELIVERY_AGENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "AccountRole" NOT NULL DEFAULT 'CUSTOMER';
