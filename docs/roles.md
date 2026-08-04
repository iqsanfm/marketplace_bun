# Role & Pembagian Kerja

> Status: **Paket A, B, dan C sudah jalan di kode** per 4 Agustus 2026.
> Cek (butuh dev server + docker hidup):
> `bash scripts/smoke-roles.sh` — 58 assertion, regresi izin & alur.
> `bash scripts/simulate.sh` — 69 assertion, simulasi 1 hari kerja + edge case + adu balap
> request + verifikasi angka laporan (summary & best-seller).

## Konteks

Aplikasi ini dipakai bareng-bareng oleh beberapa orang dengan pekerjaan berbeda,
bukan cuma "admin vs bukan admin".

| Peran             | Kerjaannya                                                              | Channel   |
| ----------------- | ----------------------------------------------------------------------- | --------- |
| **Admin / Owner** | Supervisor. Kelola user & role, kelola master produk                    | semua     |
| **Kasir**         | Layani pembeli yang datang langsung, bikin transaksi, terima pembayaran | `offline` |
| **Admin Online**  | Pembeli chat via WA/online, admin yang bikinin orderannya               | `online`  |
| **Packaging**     | Kemas orderan yang sudah `paid`, siapkan untuk diambil driver           | `online`  |
| **Gudang**        | Stock Opname (SO) — cocokkan stok sistem vs stok fisik                  | —         |

`orderChannel` nentuin siapa yang pegang order: offline → kasir, selesai di tempat.
Online → admin online yang input → dibayar → packaging kemas → driver ambil.

---

## Keputusan yang sudah disepakati

1. **`admin` sekarang ≠ admin online.** Beda orang. `admin` tetap dipakai untuk
   supervisor/owner, role baru namanya `admin_online`.
   → Sengaja **tidak** me-rename `admin` jadi `owner`: rename nilai enum di Postgres
   harus recreate type + update semua row. Nambah nilai baru jauh lebih murah.

2. **Master produk (create/edit/delete) = admin only.** Gudang **tidak** bikin atau
   hapus produk — dia cuma menyesuaikan stok. Ini sekaligus nutup lubang yang ada
   sekarang (create & delete produk belum ada cek role sama sekali).

3. **Satu user = satu role.** Gak ada rangkap jabatan, jadi kolom `role` tunggal
   yang sekarang sudah cukup — gak perlu tabel `user_roles`.

4. **Kasir & admin online boleh cancel transaksi sendiri**, tapi **wajib isi alasan**.
   Alasannya disimpan, bukan cuma dipakai buat validasi.

5. **Packaging cuma lihat order `online` yang sudah `paid`.** Bukan semua transaksi.

6. **Setiap perpindahan status pengemasan harus kecatat siapa pelakunya.**
   Termasuk `paidBy` — siapa yang nerima pembayaran (sekarang cuma ada `paidAt`).

7. **Role `user` tidak dihapus dari enum** (mahal), tapi berhenti dipakai:
   jadi status "belum ditugaskan" untuk user baru. User existing yang role-nya `user`
   di-migrate jadi `kasir` — karena memang itu yang mereka kerjakan sekarang.

8. **Gudang lihat produk seutuhnya** (termasuk harga), tapi **tidak** punya akses transaksi.
   → Harga bukan rahasia buat orang gudang, dan nyembunyiin satu kolom cuma bikin
   service produk harus tau role pemanggil — ribet tanpa alasan.
   → Kalau nanti gudang perlu tau barang mana yang laku buat restock,
   `GET /product/best-seller` yang sudah ada sudah cukup — gak perlu buka akses transaksi.

9. **`diambil` = status akhir.** Setelah driver ambil barang, tanggung jawab selesai.
   Gak ada status lanjutan "sampai"/"selesai".

10. **Cancel mengembalikan stok otomatis**, termasuk kalau barangnya sudah terlanjur
    dikemas. (Perilaku ini sudah ada di `updateTransactionStatus` sekarang.)

---

11. **Cancel transaksi yang sudah `paid` = admin only.** Beda kelas dari cancel order
    yang belum bayar: di sini uang sudah masuk dan harus dibalikin. Kasir / admin online
    yang salah harus lapor ke admin.

12. **Refund tidak dicatat di sistem.** Cukup transaksinya berstatus `cancelled` +
    alasannya tersimpan; urusan uang diselesaikan di luar aplikasi.
    → Jadi **tidak ada** kolom `refundedAt` / status "sudah direfund".

---

## Aturan transisi status (sudah di kode)

`updateTransactionStatus` dulu cuma mengizinkan transisi dari `pending`, jadi order
yang sudah `paid` mentok dan tidak bisa dibatalkan sama sekali. Itu bentrok sama alur
online (bayar dulu → dikemas → bisa batal). Sekarang:

| Dari        | Ke          | Siapa                                   |
| ----------- | ----------- | --------------------------------------- |
| `pending`   | `paid`      | admin, kasir, admin_online              |
| `pending`   | `cancelled` | admin, kasir, admin_online              |
| `paid`      | `cancelled` | **admin only**, dan **belum** `diambil` |
| `cancelled` | apa pun     | — (final)                               |
| `paid`      | `paid`      | — (ditolak)                             |

Cek `paid → cancelled` ada di service (`src/services/transaction.service.js`), bukan
di route, karena aturannya bergantung pada status transaksi **saat itu** — dan itu baru
ketahuan setelah baca DB. Middleware di route tidak punya informasi itu.

`cancelReason` wajib diisi untuk semua cancel (divalidasi di
`src/validators/transaction.validator.js`), dan tersimpan bareng `cancelledBy`.

**Barang yang sudah `diambil` driver tidak bisa di-cancel.** Kalau boleh, stok sistem
nambah padahal barangnya sudah keluar rak. Retur harus lewat barangnya balik dulu dan
dicek admin — bukan lewat tombol cancel.

**Retur barang yang sudah dibawa driver** dicatat lewat penyesuaian stok yang sudah ada,
**bukan** lewat endpoint khusus: admin cek barangnya dulu, kalau memang balik dan masih
layak jual, admin `POST /product/:id/stock-adjustments` dengan alasan `"retur trx <id>"`.
Jejaknya sudah lengkap di situ (siapa, kapan, stok sebelum/sesudah, alasan) dan itulah
bukti bahwa barangnya sudah dicek.
→ Transaksinya sengaja **tetap `paid`**, sejalan sama keputusan 12: urusan uang
diselesaikan di luar aplikasi. Kalau nanti laporan omzet perlu ikut terkoreksi otomatis,
baru bikin endpoint retur sendiri.

Invoice transaksi `cancelled` tetap bisa dicetak sebagai bukti order pernah ada, tapi
`statusLabel`-nya **"Batal"** — sebelumnya ikut jatuh ke "Belum Dibayar", padahal uangnya
bisa saja sudah sempat masuk.

Order yang di-cancel `fulfillmentStatus`-nya dikosongkan supaya keluar dari antrian
packaging. Jejak "pernah dikemas" tetap kesimpan di `packedBy`/`packedAt`.

Barisnya dikunci `SELECT ... FOR UPDATE`. Tanpa itu 2 request cancel yang datang
barengan (kasir dobel-klik, atau request diulang karena jaringan lemot) sama-sama
lolos guard dan stoknya balik 2x. Ini sudah kebukti kejadian di `scripts/simulate.sh`,
bukan teori. Kunci yang sama juga dipasang di `updateFulfillmentStatus` — tanpa itu,
2 orang packaging yang klik "dikemas" barengan dua-duanya dijawab sukses padahal
`packedBy` cuma mencatat satu.

---

## Permission matrix (rancangan)

| Aksi                           | admin | kasir | admin_online | packaging | gudang |
| ------------------------------ | :---: | :---: | :----------: | :-------: | :----: |
| Kelola user & role             |  ✅²  |       |              |           |        |
| Kelola member (pembeli)        |  ✅   |  ✅   |      ✅      |           |        |
| Tambah/edit/hapus produk       |  ✅   |       |              |           |        |
| Lihat daftar produk            |  ✅   |  ✅   |      ✅      |    ✅     |   ✅   |
| Sesuaikan stok (SO)            |  ✅   |       |              |           |   ✅   |
| Bikin transaksi `offline`      |  ✅   |  ✅   |              |           |        |
| Bikin transaksi `online`       |  ✅   |       |      ✅      |           |        |
| Tandai `paid`                  |  ✅   |  ✅   |      ✅      |           |        |
| Cancel `pending` (+alasan)     |  ✅   |  ✅   |      ✅      |           |        |
| Cancel `paid` (+alasan)        |  ✅   |       |              |           |        |
| Lihat semua transaksi          |  ✅   |  ✅   |      ✅      |           |   ❌   |
| Lihat order online yang `paid` |  ✅   |       |      ✅      |    ✅     |        |
| Ubah status pengemasan         |  ✅   |       |              |    ✅     |        |

² Kecuali role dirinya sendiri — admin tidak bisa menaikkan/menurunkan rolenya sendiri.
Kalau admin terakhir menurunkan diri jadi kasir, tidak ada lagi yang bisa mengembalikan
lewat API dan harus dibetulkan lewat SQL.

Role `user` (belum ditugaskan) **tidak punya akses apa pun**, termasuk lihat katalog
produk. Semua route `/product` dan `/member` sudah ada guard role-nya.

Karena matriks-nya sudah selebar ini, **saya tarik balik saran saya yang kemarin**:
guard inline `if (loggedInUser.role !== "admin")` sudah gak sepadan lagi. Sekarang
worth bikin satu middleware `requireRole("admin", "gudang")` dan dipasang di route,
sejalur sama `authMiddleware` yang sudah ada.

→ Sudah dibikin di `src/middlewares/auth.middleware.js`. Guard inline yang lama di
`updateProduct` dan `updateUserRole` sudah dicabut supaya aturannya cuma ada di satu
tempat (route), bukan kesebar di controller.

---

## Yang perlu dibangun (3 pekerjaan terpisah)

### A. Role & permission — ✅ SELESAI

Tambah nilai ke `userRoleEnum`, bikin `requireRole` middleware, pasang di route,
migrate user `user` → `kasir`. Paling kecil, gak bergantung fitur lain.

Dikerjakan lewat 2 migration terpisah, karena Postgres tidak mengizinkan nilai enum
dipakai di transaction yang sama dengan yang menambahkannya:

- `20260804025507_free_vulcan` — 4 nilai enum baru + kolom `paidBy`, `cancelReason`, `cancelledBy`
- `20260804025525_migrate_user_to_kasir` — `UPDATE users SET role='kasir' WHERE role='user'`

`paidBy` yang tadinya direncanakan di paket B ikut masuk sini, karena aturan cancel
sudah butuh jejak siapa yang menerima pembayaran.

### B. Alur pengemasan (packaging) — ✅ SELESAI

`transactionStatusEnum` (`pending|paid|cancelled`) itu soal **pembayaran**, jangan
dicampur. Butuh kolom sendiri, misal `fulfillmentStatus`, cuma relevan buat order `online`:

```
(paid) → belum_dikemas → dikemas → diambil
```

`dikemas` di sini berarti **sudah selesai dikemas & siap diambil** (bukan "sedang
dikerjakan"), jadi cuma 2 transisi yang perlu tombol. `diambil` = status akhir.

Plus kolom siapa & kapan tiap transisi: `packedBy`/`packedAt` dan
`handedOverBy`/`handedOverAt` (`paidBy` sudah ada, ikut kepasang di paket A).

> Kenapa kolom, bukan tabel log terpisah: transisinya cuma 2 dan tetap. Kalau nanti
> state-nya nambah banyak atau butuh riwayat "pernah balik ke status sebelumnya",
> baru pindah ke tabel event.
>
> Kalau nanti orang packaging-nya lebih dari satu dan sering rebutan orderan yang sama,
> baru tambah state "sedang_dikemas" sebagai penanda siapa yang ngerjain.

**Hasilnya di kode** (migration `20260804030951_opposite_marauders`):

- Kolom `fulfillmentStatus` **nullable**. `null` = tidak perlu dikemas (order offline,
  atau online yang belum dibayar). Diisi otomatis jadi `belum_dikemas` begitu order
  **online** ditandai `paid` — tidak ada tombol "masukkan ke antrian" yang harus ditekan
  manual, jadi tidak bisa kelewat.
- `PATCH /transactions/:id/fulfillment` — admin & packaging. Transisinya cuma maju satu
  langkah: `belum_dikemas → dikemas → diambil`. Lompat atau mundur ditolak 400.
- Order offline atau yang belum `paid` ditolak dari endpoint ini.
- Migration sekalian backfill order online yang sudah `paid` sebelum fitur ini ada.

Akses packaging disaring 2 lapis, karena role saja tidak cukup:

| Endpoint                        | Yang dicek                                          |
| ------------------------------- | --------------------------------------------------- |
| `GET /transactions`             | controller paksa filter `online` + `paid`             |
| `GET /transactions/:id`         | service tolak 403 kalau barisnya bukan online+paid   |
| `/summary`, `/invoice`, `POST`, `/status` | route: packaging tidak masuk sama sekali    |

`transactionRoute` sekarang tidak pakai satu blanket `requireRole` lagi — tiap route
punya guard sendiri (`penjualan` / `pengemasan` / `keduanya`), karena matriksnya sudah
tidak seragam.

### C. Stock Opname (gudang) — ✅ SELESAI

Pakai **log penyesuaian per produk**, bukan sesi buka/tutup — alasannya di bawah.

---

## Soal SO: per-produk atau sesi?

Kamu bener, di lapangan SO memang biasanya pas penutupan. Tapi itu **kapan orangnya
kerja**, bukan harus gimana sistemnya dibikin. Dua model yang mungkin:

**Model 1 — catatan penyesuaian (log per produk).**
Gudang hitung fisik, ketemu selisih, dia catat: produk X sistem 50, fisik 47, alasan
"rusak 3". Sistem simpan satu baris riwayat + update stok. Gak ada "buka/tutup sesi".

**Model 2 — sesi SO.**
Ada sesi yang dibuka ("SO Juli 2026"), gudang isi hasil hitungan semua produk,
lalu sesi ditutup dan semua penyesuaian diterapkan sekaligus.

**Keputusan: Model 1 dulu.** Alasannya:

- Kalau prakteknya SO dilakukan pas tutup toko, catatan-catatannya toh otomatis
  ngumpul di jam yang sama — hasilnya sama saja, tanpa perlu bikin mesin buka/tutup sesi.
- Model 2 punya masalah yang gak kelihatan di awal: gimana kalau di tengah sesi ada
  transaksi masuk dan stok berubah? Sesi yang lupa ditutup gimana? Sesi yang baru
  keisi separuh gimana? Itu semua kerjaan tambahan yang belum tentu kepakai.
- Model 1 juga otomatis kepakai buat kejadian sehari-hari yang bukan SO: barang pecah,
  barang expired, salah input. Model 2 gak nutup kasus ini.

Bentuknya kira-kira satu tabel `stock_adjustments`:
`productId`, `userId` (siapa), `stockBefore`, `stockAfter`, `reason`, `createdAt`.
Stoknya diupdate lewat endpoint ini, **bukan** lewat `editProductById` — supaya
setiap perubahan stok selalu ada jejaknya.

**Hasilnya di kode** (migration `20260804031422_nosy_hobgoblin`):

- `POST /product/:id/stock-adjustments` — admin & gudang. Body: `stockAfter` (hasil
  hitung fisik) + `reason` (wajib). Sistem yang baca `stockBefore` dari DB, jadi tidak
  bisa dikarang.
- `GET /product/:id/stock-adjustments` — riwayat, terbaru dulu, plus nama pelakunya.
- Insert log + update stok jalan dalam satu transaksi, dan barisnya dikunci
  `SELECT ... FOR UPDATE`. Tanpa itu, penjualan yang masuk barengan bisa ketimpa
  angka hasil hitungan fisik.
- `stock` **dicabut** dari `PATCH /product/:id`. Kalau masih dikirim, ditolak 400 dengan
  pesan yang nunjuk ke endpoint SO — sengaja tidak dibuang diam-diam, biar client tidak
  mengira stoknya sudah berubah.

Stok jadi cuma bisa bergerak lewat 2 jalan: transaksi (jual / cancel) dan penyesuaian SO.

**Jalan naiknya kalau nanti butuh Model 2:** tambah tabel `stock_opname_sessions` dan
satu kolom `sessionId` (boleh kosong) di `stock_adjustments`. Data riwayat yang lama
tetap kepakai, gak ada yang dibuang. Jadi milih Model 1 sekarang gak bikin buntu nanti.

---

## Urutan kerja — sudah dijalankan

**A (role)** → **B (packaging)** → **C (SO)**, ketiganya selesai 4 Agustus 2026 lewat
4 migration:

| Migration                             | Isi                                            |
| ------------------------------------- | ---------------------------------------------- |
| `20260804025507_free_vulcan`           | 4 role baru + `paidBy`, `cancelReason`, `cancelledBy` |
| `20260804025525_migrate_user_to_kasir` | user lama `user` → `kasir`                      |
| `20260804030951_opposite_marauders`    | `fulfillmentStatus` + kolom packing/serah-terima |
| `20260804031422_nosy_hobgoblin`        | tabel `stock_adjustments`                       |

Perubahan aturan cancel (`paid` → `cancelled`) ikut di **A**, karena itu murni soal
siapa boleh apa dan gak nunggu fitur packaging jadi.

---

## Yang sengaja belum dikerjakan

Bukan lupa — ditunda karena belum kepakai atau nunggu paket lain:

1. **Role `user` masih ada di enum tapi tidak punya akses ke apa pun.** Ini memang
   yang dimau (poin 7): user baru dari `/users/register` masuk sebagai "belum
   ditugaskan" sampai admin kasih role lewat `PATCH /users/:id/role`.
