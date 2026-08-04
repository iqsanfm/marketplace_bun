CREATE TYPE "order_channel" AS ENUM('offline', 'online');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "orderChannel" "order_channel" DEFAULT 'offline'::"order_channel" NOT NULL;