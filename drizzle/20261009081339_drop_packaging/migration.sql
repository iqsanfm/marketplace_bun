ALTER TABLE "transactions" DROP CONSTRAINT "transactions_packedBy_users_id_fkey";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_handedOverBy_users_id_fkey";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
-- Role packaging dihapus (alur pengemasan tidak dipakai lagi). User lama dipindah ke
-- gudang selagi kolomnya masih text — kalau tidak, cast balik ke enum baru gagal.
UPDATE "users" SET "role" = 'gudang' WHERE "role" = 'packaging';--> statement-breakpoint
DROP TYPE "user_role";--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'admin', 'kasir', 'admin_online', 'gudang');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "user_role" USING "role"::"user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"user_role";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "fulfillmentStatus";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "packedBy";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "packedAt";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "handedOverBy";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "handedOverAt";--> statement-breakpoint
DROP TYPE "fulfillment_status";