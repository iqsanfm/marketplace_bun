-- Menambah 4 nilai baru ke enum "user_role" dengan cara membuat ulang tipe-nya,
-- bukan lewat ALTER TYPE ... ADD VALUE.
--
-- Alasannya: migrator drizzle menjalankan SEMUA migration yang pending di dalam
-- SATU transaksi, dan Postgres melarang nilai enum dipakai pada transaksi yang
-- sama dengan yang menambahkannya (SQLSTATE 55P04, "New enum values must be
-- committed before they can be used"). Memisah ke file migration terpisah tidak
-- menolong, karena batas file bukan batas transaksi. Di DB yang skema-nya sudah
-- terbentuk bertahap hal ini tidak terlihat; di DB kosong migration-nya gagal.
--
-- Nilai pada tipe yang DIBUAT di transaksi berjalan boleh langsung dipakai, jadi
-- pendekatan rename + create + convert + drop ini aman satu transaksi, sekaligus
-- membuat migration berikutnya (UPDATE ... SET role = 'kasir') bisa jalan.
ALTER TYPE "user_role" RENAME TO "user_role_old";--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'admin', 'kasir', 'admin_online', 'packaging', 'gudang');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"user_role";--> statement-breakpoint
DROP TYPE "user_role_old";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paidBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cancelReason" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cancelledBy" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paidBy_users_id_fkey" FOREIGN KEY ("paidBy") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cancelledBy_users_id_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "users"("id");
