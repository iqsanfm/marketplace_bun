CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL UNIQUE,
	"email" varchar(255),
	"address" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "memberId" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_memberId_members_id_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id");