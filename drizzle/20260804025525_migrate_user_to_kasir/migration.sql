-- Role "user" berhenti dipakai sebagai peran aktif; user existing memang kerjanya kasir.
-- Nilai 'kasir' disediakan oleh migration sebelumnya, yang sengaja membuat ulang tipe
-- "user_role" supaya nilainya bisa langsung dipakai di transaksi yang sama (lihat
-- catatan di sana soal SQLSTATE 55P04).
UPDATE "users" SET "role" = 'kasir' WHERE "role" = 'user';
