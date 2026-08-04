CREATE TYPE "fulfillment_status" AS ENUM('belum_dikemas', 'dikemas', 'diambil');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fulfillmentStatus" "fulfillment_status";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "packedBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "packedAt" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "handedOverBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "handedOverAt" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_packedBy_users_id_fkey" FOREIGN KEY ("packedBy") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_handedOverBy_users_id_fkey" FOREIGN KEY ("handedOverBy") REFERENCES "users"("id");--> statement-breakpoint
-- Order online yang sudah dibayar sebelum fitur ini ada tetap harus masuk antrian
-- packaging. Boleh satu migration dengan CREATE TYPE di atas — yang dilarang Postgres
-- itu ALTER TYPE ADD VALUE pada type yang sudah ada, bukan type yang baru dibuat.
UPDATE "transactions" SET "fulfillmentStatus" = 'belum_dikemas'
WHERE "orderChannel" = 'online' AND "status" = 'paid';