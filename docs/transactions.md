# Transaction API

Base path: `/transactions`

Semua endpoint di bawah ini butuh login. Kirim header:

```
Authorization: Bearer <token>
```

Kalau header nggak ada/salah format → `401 { success: false, error: "Token tidak ada" }`
Kalau token nggak valid/expired → `401 { success: false, error: "Token tidak valid" }` atau `"Sesi sudah berakhir"`.

## Format response

Semua response JSON dengan bentuk konsisten:

- Sukses: `{ "success": true, "data": ... }`
- Gagal: `{ "success": false, "error": "<pesan>" }`

---

## 1. Buat transaksi

`POST /transactions`

Role: **semua user yang login** (kasir/admin).

### Request body
```json
{
  "items": [
    { "productId": "uuid-produk", "quantity": 2 }
  ]
}
```
- `items` minimal 1 item.
- `productId` harus UUID valid.
- `quantity` harus integer > 0.
- User pembuat transaksi diambil otomatis dari token login (tidak perlu dikirim).

### Response `201`
```json
{
  "success": true,
  "data": {
    "id": "uuid-transaksi",
    "userId": "uuid-user",
    "status": "pending",
    "totalAmount": "50000",
    "createdAt": "2026-07-27T10:00:00.000Z"
  }
}
```
Status transaksi baru **selalu `pending`**. Stok produk otomatis berkurang saat transaksi dibuat.

### Error yang mungkin
- `404` — salah satu `productId` tidak ditemukan.
- `400` — stok produk tidak cukup, pesan: `"Stock <nama_produk> tidak cukup"`.

---

## 2. List transaksi

`GET /transactions`

Role: semua user yang login.

### Query params (semua optional)
| param | tipe | default | keterangan |
|---|---|---|---|
| `status` | `pending` \| `paid` \| `cancelled` | - | filter status |
| `page` | number | `1` | halaman ke- |
| `limit` | number | `10` | max `100` |

Contoh:
- Filter transaksi `paid`/`cancelled`: `GET /transactions?status=cancelled`
- Pagination: `GET /transactions?page=2&limit=5&status=paid`

### Response `200`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "userId": "uuid",
        "status": "pending",
        "totalAmount": "50000",
        "paymentMethod": null,
        "createdAt": "2026-07-27T10:00:00.000Z"
      }
    ],
    "total": 37,
    "page": 1,
    "limit": 10,
    "totalPages": 4
  }
}
```
> Catatan: data list ini **ringkasan**, tidak termasuk `items`. Untuk detail item pakai endpoint di bawah.

---

## 3. Detail transaksi

`GET /transactions/:id`

Role: semua user yang login.

### Response `200`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "status": "paid",
    "totalAmount": "50000",
    "paymentMethod": "cash",
    "paidAt": "2026-07-27T10:05:00.000Z",
    "createdAt": "2026-07-27T10:00:00.000Z",
    "items": [
      {
        "id": "uuid-item",
        "productId": "uuid-produk",
        "productName": "Kopi Susu",
        "quantity": 2,
        "priceAtPurchase": "25000"
      }
    ]
  }
}
```

### Error
- `404` — transaksi tidak ditemukan (`id` harus UUID valid, kalau format salah kena `400` dari validasi).

---

## 4. Ubah status transaksi

`PATCH /transactions/:id/status`

### Request body
```json
{
  "status": "paid",       // "paid" | "cancelled"
  "paymentMethod": "cash" // "cash" | "transfer" — WAJIB kalau status "paid"
}
```

### Role & aturan
- **`pending → paid`**: bisa dilakukan **user biasa (kasir) maupun admin**.
- **`→ cancelled`**: **hanya admin**. Kalau non-admin coba cancel → `403 "Hanya admin yang boleh membatalkan transaksi"`.
- Transisi status **cuma bisa dari `pending`**. Transaksi yang sudah `paid`/`cancelled` tidak bisa diubah lagi → `400 "Transaksi sudah berstatus "<status>", tidak bisa diubah lagi"`.
- Kalau di-cancel, stok produk yang terpakai otomatis dikembalikan.
- Kalau di-set `paid`, `paidAt` otomatis diisi timestamp saat itu.

### Response `200`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "paid",
    "paymentMethod": "cash",
    "paidAt": "2026-07-27T10:05:00.000Z"
  }
}
```

### Error
- `403` — non-admin coba cancel.
- `404` — transaksi tidak ditemukan.
- `400` — transisi tidak valid (bukan dari `pending`), atau `paymentMethod` kosong padahal status `paid`.

---

## 5. Ringkasan transaksi

`GET /transactions/summary`

Role: semua user yang login.

### Response `200`
```json
{
  "success": true,
  "data": [
    { "status": "pending", "count": 5, "total": "150000" },
    { "status": "paid", "count": 20, "total": "2000000" },
    { "status": "cancelled", "count": 2, "total": "80000" }
  ]
}
```
Group by status, cuma status yang punya minimal 1 transaksi yang muncul (tidak ada 0 default).

---

## Ringkasan endpoint

| Method | Path | Siapa boleh akses |
|---|---|---|
| POST | `/transactions` | user login |
| GET | `/transactions` | user login |
| GET | `/transactions/:id` | user login |
| PATCH | `/transactions/:id/status` (paid) | user login |
| PATCH | `/transactions/:id/status` (cancelled) | admin |
| GET | `/transactions/summary` | user login |
