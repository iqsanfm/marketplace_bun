# Error Handling

Cara nge-throw error dari `services/` supaya controller balikin HTTP status yang bener (bukan selalu 200/400).

## Kenapa dibutuhkan

Query DB yang gak nemu row itu tetap "berhasil" (gak throw). Kalau service cuma `return` hasil yang `undefined`, controller bakal balikin `success(c, undefined)` → status 200 padahal harusnya 404.

## Komponen

- `src/utils/errors.js`
  - `AppError` — base error, bawa `.status` (default 400).
  - `NotFoundError` — shortcut `AppError` dengan status 404.
- `src/utils/response.js` — `error(c, message, status)` udah nerima `status` custom, default 400.
- `src/controllers/*.controllers.js` — di `catch`, pass `err.status ?? 400` ke `error()`.

## Pola di service

```js
// services/user.service.js
if (!user) throw new NotFoundError("User not found");
```

Untuk status lain yang belum ada shortcut-nya, pakai `AppError` langsung, gak perlu subclass baru:

```js
throw new AppError("Email atau password salah", 401);
throw new AppError("Tidak punya akses", 403);
```

## Pola di controller

```js
} catch (err) {
  return error(c, err.message, err.status ?? 400);
}
```

Kalau errornya dari `parseDbError` (unique/FK/not-null violation) yang gak punya `.status`, otomatis fallback ke 400.

## Kapan bikin subclass baru

Cuma kalau salah satu ini kejadian, jangan disiapin di depan:

- Status itu dipakai berkali-kali di banyak service dengan default message yang sama.
- Butuh `instanceof` check di tempat lain (middleware logging, dsb).

Contoh kandidat ke depan: `ConflictError` (409) buat duplicate data — sekarang `parseDbError` masih balikin plain `Error` buat kode `23505` sehingga jatuh ke default 400.

## Kandidat lain yang sengaja belum dibikin (YAGNI)

- Validasi format UUID di route (`zValidator("param", ...)`) — biar id yang bukan UUID sama sekali (misal `"abc"`) ketangkep sebagai 400 di layer validasi, bukan nyampe ke Postgres dan balik pesan error native (`22P02`). Tambahin kalau endpoint publicly exposed / sering dapet garbage id.
