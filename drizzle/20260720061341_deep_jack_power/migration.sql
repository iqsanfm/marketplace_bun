CREATE TYPE "payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paymentMethod" "payment_method";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paidAt" timestamp;