ALTER TYPE "user_role" ADD VALUE 'kasir';--> statement-breakpoint
ALTER TYPE "user_role" ADD VALUE 'admin_online';--> statement-breakpoint
ALTER TYPE "user_role" ADD VALUE 'packaging';--> statement-breakpoint
ALTER TYPE "user_role" ADD VALUE 'gudang';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paidBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cancelReason" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cancelledBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paidBy_users_id_fkey" FOREIGN KEY ("paidBy") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cancelledBy_users_id_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "users"("id");