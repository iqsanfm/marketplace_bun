-- Role "user" berhenti dipakai sebagai peran aktif; user existing memang kerjanya kasir.
-- Harus migration terpisah: Postgres tidak mengizinkan nilai enum dipakai di transaction
-- yang sama dengan yang menambahkannya (lihat migration sebelumnya).
UPDATE "users" SET "role" = 'kasir' WHERE "role" = 'user';
