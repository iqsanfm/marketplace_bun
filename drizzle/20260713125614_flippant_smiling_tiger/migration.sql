CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"product_name" varchar(255) NOT NULL,
	"price" numeric NOT NULL,
	"stock" integer NOT NULL,
	"sku" varchar(100),
	"description" text,
	"category" varchar(100)
);
