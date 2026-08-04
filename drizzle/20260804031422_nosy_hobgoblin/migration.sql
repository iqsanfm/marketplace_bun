CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"productId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"stockBefore" integer NOT NULL,
	"stockAfter" integer NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_productId_product_id_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id");