# Update API: Role, Packaging, Stock Opname — untuk Tim FE

> 4 Agustus 2026. Semua yang di bawah sudah live di branch `main` dan teruji
> (127 assertion: `scripts/smoke-roles.sh` + `scripts/simulate.sh`).
> Desain lengkapnya di `docs/roles.md`.

## Ringkasan buat yang buru-buru

1. Role sekarang 6: `user`, `admin`, `kasir`, `admin_online`, `packaging`, `gudang`.
   UI harus menyembunyikan/menampilkan menu berdasarkan `role` dari response login.
2. Cancel transaksi **wajib kirim `cancelReason`** — siapkan modal input alasan.
3. Ada alur baru **pengemasan** (`fulfillmentStatus`) untuk order online yang sudah dibayar.
4. Ada endpoint baru **penyesuaian stok** — dan stok **tidak bisa lagi** diubah lewat
   edit produk.
5. Semua penolakan konsisten: `401` belum login, `403` role tidak boleh, `400` aturan
   bisnis, bentuk body selalu `{ success: false, error: "pesan siap tampil" }`.
   Pesan error sudah bahasa Indonesia — aman ditampilkan langsung ke user.

---

## 1. Role & akses

`POST /users/login` → `data.role` berisi salah satu dari 6 role. Petakan menu:

| Role           | Boleh apa                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| `user`         | **Tidak ada apa-apa.** Ini status "belum ditugaskan" untuk akun baru. Tampilkan halaman "hubungi admin untuk aktivasi". |
| `admin`        | Semua.                                                                    |
| `kasir`        | Katalog produk, member, transaksi **offline**, terima pembayaran, cancel `pending`. |
| `admin_online` | Katalog produk, member, transaksi **online**, terima pembayaran, cancel `pending`. |
| `packaging`    | Katalog produk + antrian kemasan (lihat bagian 3).                        |
| `gudang`       | Katalog produk + penyesuaian stok (lihat bagian 4). **Tanpa** transaksi & member. |

Detail per endpoint:

- `GET /users`, `GET /users/:id`, `PATCH /users/:id/role` → **admin only** (dulu bebas).
- `PATCH /users/:id/role` ke **diri sendiri** → `400 "Role sendiri tidak bisa diubah, minta admin lain"`. Disable tombol edit role di baris akun sendiri.
- Register publik tetap ada; field `role` di body **diabaikan** — akun baru selalu `user`.
- `/product` (semua method) → role `user` ditolak `403`.
- Create/edit/delete produk → admin only (sudah dari kemarin, sekarang di level route).
- `/member` (semua method) → admin, kasir, admin_online saja.

## 2. Transaksi: field baru & aturan cancel

### Field baru di response transaksi (list & detail)

```jsonc
{
  "status": "paid",              // pending | paid | cancelled (tidak berubah)
  "fulfillmentStatus": null,     // null | belum_dikemas | dikemas | diambil  ← BARU
  "paidBy": "uuid",              // siapa yang terima pembayaran               ← BARU
  "cancelReason": "…",           // alasan batal                               ← BARU
  "cancelledBy": "uuid",         //                                            ← BARU
  "packedBy": "uuid", "packedAt": "…",         // ← BARU (detail)
  "handedOverBy": "uuid", "handedOverAt": "…"  // ← BARU (detail)
}
```

`fulfillmentStatus = null` artinya order tidak perlu dikemas (offline, belum dibayar,
atau sudah dibatalkan).

### Cancel

`PATCH /transactions/:id/status` body cancel sekarang:

```json
{ "status": "cancelled", "cancelReason": "salah input" }
```

- `cancelReason` **wajib** (1–500 karakter) → tanpa itu `400`. Bikin modal alasan,
  jangan tombol cancel sekali klik.
- Cancel transaksi `pending` → kasir/admin_online/admin boleh.
- Cancel transaksi **sudah `paid`** → **admin only**, lainnya `403`. Sembunyikan
  tombolnya untuk non-admin kalau `status === "paid"`.
- Cancel order yang `fulfillmentStatus === "diambil"` → **selalu `400`**, admin pun
  tidak bisa. Barang sudah dibawa driver; retur diproses admin lewat penyesuaian stok
  setelah barangnya dicek fisik. Sembunyikan tombol cancel kalau sudah `diambil`.
- Dobel-klik aman di server (request kedua dapat `400`), tapi tetap disable tombol
  setelah klik pertama supaya user tidak lihat error membingungkan.

### Bikin transaksi

- `kasir` kirim `orderChannel: "online"` → `403`. `admin_online` kirim `"offline"` → `403`.
  Paling gampang: jangan kasih pilihan channel di UI — set otomatis dari role.

## 3. BARU: alur pengemasan (layar untuk role packaging)

Order **online** yang ditandai `paid` otomatis muncul dengan
`fulfillmentStatus: "belum_dikemas"`. Tidak ada aksi manual untuk memasukkan ke antrian.

- **Antrian**: `GET /transactions` — untuk role packaging response otomatis tersaring
  cuma order online yang sudah dibayar. Bisa difilter lagi:
  `GET /transactions?fulfillmentStatus=belum_dikemas`.
- **Aksi** (`PATCH /transactions/:id/fulfillment`, role packaging & admin):

```json
{ "fulfillmentStatus": "dikemas" }   // selesai dikemas, siap diambil driver
{ "fulfillmentStatus": "diambil" }   // driver sudah ambil — status FINAL
```

Alurnya cuma maju satu-satu: `belum_dikemas → dikemas → diambil`. Lompat/mundur → `400`.
Jadi tiap kartu order cuma butuh **satu tombol** sesuai status sekarang.

Kalau dua orang packaging klik barengan, yang telat dapat `400` — tampilkan sebagai
"sudah dikerjakan orang lain", lalu refresh antrian.

Packaging buka detail order yang bukan wewenangnya (offline / belum dibayar) → `403`.

## 4. BARU: penyesuaian stok (layar untuk role gudang)

Stok **tidak bisa lagi** diubah lewat `PATCH /product/:id` — kirim field `stock` →
`400 "Stok tidak bisa diubah lewat sini, pakai POST /product/:id/stock-adjustments"`.
**Hapus input stok dari form edit produk.** (Stok awal di create produk tetap ada.)

- **Catat penyesuaian** — `POST /product/:id/stock-adjustments` (admin & gudang):

```json
{ "stockAfter": 47, "reason": "SO sore: rusak 3" }
```

`stockAfter` = hasil hitungan fisik (bukan selisih). `reason` wajib.
Response berisi `stockBefore` (diisi sistem) + `stockAfter` — tampilkan selisihnya.

- **Riwayat** — `GET /product/:id/stock-adjustments?page=1&limit=10`:

```jsonc
{ "items": [ { "stockBefore": 50, "stockAfter": 47, "reason": "…",
               "adjustedBy": "Nama User", "createdAt": "…" } ],
  "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
```

Dipakai juga untuk **retur**: barang yang sudah dibawa driver lalu balik → admin cek
fisik → catat penyesuaian dengan alasan `"retur trx <id>"`. Tidak ada endpoint retur
terpisah.

## 5. Perubahan kecil tapi kelihatan di UI

- **Invoice** (`GET /transactions/:id/invoice`): `statusLabel` sekarang bisa `"Batal"`
  (selain `"Lunas"` / `"Belum Dibayar"`).
- **Member**: `email` sekarang **opsional** saat daftar; `PATCH /member/:id` boleh
  kirim sebagian field saja (dulu wajib semua).
- **Hapus produk** yang sudah pernah dijual → `400 "Data ini masih dipakai data lain,
  tidak bisa dihapus"` (dulu pesannya membingungkan).
- Filter baru di list transaksi: `?fulfillmentStatus=belum_dikemas|dikemas|diambil`.

## Checklist implementasi FE

- [ ] Simpan `role` dari login, gate menu & tombol per tabel di atas
- [ ] Halaman "belum ditugaskan" untuk role `user`
- [ ] Modal alasan saat cancel (wajib), tombol cancel disembunyikan sesuai aturan
- [ ] Channel transaksi otomatis dari role (bukan pilihan bebas)
- [ ] Layar antrian packaging: list + satu tombol per status, handle `400` = rebutan
- [ ] Layar SO gudang: form stockAfter+reason, tabel riwayat
- [ ] Hapus input stok dari form edit produk
- [ ] Label invoice "Batal"
