#!/bin/bash
# Simulasi operasional + edge case. Beda tujuan dari smoke-roles.sh:
# smoke-roles = regresi (semua harus hijau).
# simulate    = eksplorasi (bagian TEMUAN sengaja menampilkan perilaku apa adanya
#               buat didiskusikan, bukan buat dinyatakan lulus/gagal).
#
# Jalankan dengan dev server + docker hidup: bash scripts/simulate.sh
B=http://localhost:${PORT:-2080}
DB="docker exec -i my-app-db-1 psql -U postgres -d my_app -tAc"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
S=$RANDOM
pass=0; fail=0; findings=0

c1() { cut -d'|' -f1; }                               # status (baca stdin)
c2() { cut -d'|' -f2-; }                              # body   (baca stdin)
req() { # req <token> <method> <path> [json] -> "STATUS|BODY"
  local raw
  if [ -n "$4" ]; then
    raw=$(curl -s -w '\n%{http_code}' -X "$2" "$B$3" -H "Authorization: Bearer $1" \
          -H 'content-type: application/json' -d "$4")
  else
    raw=$(curl -s -w '\n%{http_code}' -X "$2" "$B$3" -H "Authorization: Bearer $1")
  fi
  printf '%s|%s' "$(tail -n1 <<< "$raw")" "$(sed '$d' <<< "$raw" | tr -d '\n')"
}
ok() { # ok <label> <expected> <actual>
  if [ "$2" = "$3" ]; then printf '  \033[32mOK\033[0m   %s\n' "$1"; pass=$((pass+1));
  else printf '  \033[31mFAIL\033[0m %s — harusnya [%s], dapat [%s]\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
note() { printf '  \033[33m??\033[0m   %s\n       -> %s\n' "$1" "$2"; findings=$((findings+1)); }
hdr() { printf '\n\033[1m%s\033[0m\n' "$1"; }

reg() { # reg <email> <role> -> token
  curl -s -X POST $B/users/register -H 'content-type: application/json' \
    -d "{\"name\":\"$2 sim\",\"email\":\"$1\",\"password\":\"rahasia123\"}" > /dev/null
  [ -n "$2" ] && $DB "UPDATE users SET role='$2' WHERE email='$1';" > /dev/null
  curl -s -X POST $B/users/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"rahasia123\"}" | jq -r .data.token
}
stok() { $DB "SELECT stock FROM product WHERE id='$1';"; }

ADM=$(reg "sim-adm$S@x.com" admin)
KSR=$(reg "sim-ksr$S@x.com" kasir)
AOL=$(reg "sim-aol$S@x.com" admin_online)
PKG=$(reg "sim-pkg$S@x.com" packaging)
GDG=$(reg "sim-gdg$S@x.com" gudang)
USR=$(reg "sim-usr$S@x.com" "")   # belum ditugaskan

mkprod() { # mkprod <nama> <harga> <stok> <sku> -> id
  req $ADM POST /product "{\"product_name\":\"$1\",\"price\":$2,\"stock\":$3,\"sku\":\"$4\",\"category\":\"sim\"}" \
    | c2 | jq -r .data[0].id
}
KOPI=$(mkprod "Kopi Susu SIM$S" 20000 100 "SIMK$S")
TEH=$(mkprod  "Teh Manis SIM$S" 15000 50  "SIMT$S")
ROTI=$(mkprod "Roti Bakar SIM$S" 10000 5  "SIMR$S")

# ─────────────────────────────────────────────────────────────────────
hdr "BAGIAN 1 — satu hari kerja normal"

# Pagi: pembeli datang langsung, beli 2 kopi + 1 teh
J="{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":2},{\"productId\":\"$TEH\",\"quantity\":1}]}"
R=$(req $KSR POST /transactions "$J"); T1=$(c2 <<< "$R" | jq -r .data.id)
ok "kasir bikin transaksi walk-in" 201 "$(c1 <<< "$R")"
ok "nama tamu digenerate otomatis" true "$(c2 <<< "$R" | jq -r '.data.guestName | startswith("Guest-")')"
ok "stok kopi 100 -> 98" 98 "$(stok $KOPI)"
ok "total 2x20000 + 1x15000" 55000 "$(c2 <<< "$R" | jq -r '.data.totalAmount | tonumber')"

R=$(req $KSR PATCH /transactions/$T1/status '{"status":"paid","paymentMethod":"cash"}')
ok "kasir terima pembayaran cash" 200 "$(c1 <<< "$R")"
ok "offline tidak masuk antrian kemasan" null "$(c2 <<< "$R" | jq -r .data.fulfillmentStatus)"
ok "invoice bisa dicetak" 200 "$(c1 <<< "$(req $KSR GET /transactions/$T1/invoice)")"

# Siang: pembeli chat WA, admin online yang input, pembelinya member
MJ="{\"name\":\"Budi SIM$S\",\"phone\":\"0812$S\",\"email\":\"budi$S@x.com\"}"
R=$(req $AOL POST /member/register "$MJ")
MID=$(c2 <<< "$R" | jq -r '.data[0].id // .data.id')
ok "member terdaftar" 201 "$(c1 <<< "$R")"

J="{\"items\":[{\"productId\":\"$ROTI\",\"quantity\":3}],\"orderChannel\":\"online\",\"memberId\":\"$MID\"}"
R=$(req $AOL POST /transactions "$J"); T2=$(c2 <<< "$R" | jq -r .data.id)
ok "admin online input orderan WA" 201 "$(c1 <<< "$R")"
ok "stok roti 5 -> 2" 2 "$(stok $ROTI)"

ok "belum bayar: belum masuk antrian" null "$(c2 <<< "$(req $AOL GET /transactions/$T2)" | jq -r .data.fulfillmentStatus)"
R=$(req $AOL PATCH /transactions/$T2/status '{"status":"paid","paymentMethod":"transfer"}')
ok "pembeli transfer, ditandai paid" 200 "$(c1 <<< "$R")"
ok "otomatis masuk antrian packaging" belum_dikemas "$(c2 <<< "$R" | jq -r .data.fulfillmentStatus)"

ok "packaging lihat antrian" true \
   "$(req $PKG GET "/transactions?limit=100" | c2 | jq -r --arg t "$T2" '[.data.items[].id] | index($t) != null')"
ok "packaging selesai mengemas" 200 "$(c1 <<< "$(req $PKG PATCH /transactions/$T2/fulfillment '{"fulfillmentStatus":"dikemas"}')")"
ok "driver ambil barang"        200 "$(c1 <<< "$(req $PKG PATCH /transactions/$T2/fulfillment '{"fulfillmentStatus":"diambil"}')")"

# Sore: gudang stock opname, kopi fisik kurang 2
R=$(req $GDG POST /product/$KOPI/stock-adjustments '{"stockAfter":96,"reason":"SO sore: 2 gelas tumpah"}')
ok "gudang catat selisih SO" 201 "$(c1 <<< "$R")"
ok "stockBefore diambil sistem" 98 "$(c2 <<< "$R" | jq -r .data.stockBefore)"
ok "stok kopi jadi 96" 96 "$(stok $KOPI)"

# Malam: admin rekap
ok "admin buka summary" 200 "$(c1 <<< "$(req $ADM GET /transactions/summary)")"
ok "admin buka best seller" 200 "$(c1 <<< "$(req $ADM GET /product/best-seller)")"

# ─────────────────────────────────────────────────────────────────────
hdr "BAGIAN 2 — edge case yang harus ditolak"

ok "tanpa token"        401 "$(c1 <<< "$(req "" GET /product)")"
ok "token ngasal"       401 "$(c1 <<< "$(req bukan-token GET /product)")"
$DB "UPDATE sessions SET \"expiresAt\" = now() - interval '1 day' WHERE token='$USR';" > /dev/null
ok "sesi kedaluwarsa"   401 "$(c1 <<< "$(req $USR GET /product)")"
USR=$(curl -s -X POST $B/users/login -H 'content-type: application/json' \
      -d "{\"email\":\"sim-usr$S@x.com\",\"password\":\"rahasia123\"}" | jq -r .data.token)
ok "role 'user' tidak bisa apa-apa" 403 "$(c1 <<< "$(req $USR GET /product)")"

R=$(curl -s -X POST $B/users/register -H 'content-type: application/json' \
    -d "{\"name\":\"nakal\",\"email\":\"sim-hack$S@x.com\",\"password\":\"rahasia123\",\"role\":\"admin\"}")
ok "daftar sambil ngaku admin: role diabaikan" user "$(jq -r '.data[0].role' <<< "$R")"

ok "quantity 0"          400 "$(c1 <<< "$(req $KSR POST /transactions "{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":0}]}")")"
ok "quantity minus"      400 "$(c1 <<< "$(req $KSR POST /transactions "{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":-5}]}")")"
ok "quantity pecahan"    400 "$(c1 <<< "$(req $KSR POST /transactions "{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":1.5}]}")")"
ok "items kosong"        400 "$(c1 <<< "$(req $KSR POST /transactions '{"items":[]}')")"
GHOST=$($DB "SELECT gen_random_uuid();" | tr -d ' ')
ok "produk tidak ada"    404 "$(c1 <<< "$(req $KSR POST /transactions "{\"items\":[{\"productId\":\"$GHOST\",\"quantity\":1}]}")")"
ok "member + tamu barengan" 400 \
   "$(c1 <<< "$(req $KSR POST /transactions "{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":1}],\"memberId\":\"$MID\",\"guestName\":\"Andi\"}")")"
ok "limit di atas 100"   400 "$(c1 <<< "$(req $ADM GET '/transactions?limit=500')")"
ok "page 0"              400 "$(c1 <<< "$(req $ADM GET '/transactions?page=0')")"
ok "page jauh di luar"   0   "$(req $ADM GET '/transactions?page=9999' | c2 | jq -r '.data.items | length')"

ok "SO produk tidak ada"    404 "$(c1 <<< "$(req $GDG POST /product/$GHOST/stock-adjustments '{"stockAfter":1,"reason":"x"}')")"
ok "SO tanpa alasan"        400 "$(c1 <<< "$(req $GDG POST /product/$KOPI/stock-adjustments '{"stockAfter":1}')")"
ok "SO stok minus"          400 "$(c1 <<< "$(req $GDG POST /product/$KOPI/stock-adjustments '{"stockAfter":-1,"reason":"x"}')")"
ok "edit produk bawa stock" 400 "$(c1 <<< "$(req $ADM PATCH /product/$KOPI '{"stock":9999}')")"

ok "bayar 2x"  400 "$(c1 <<< "$(req $KSR PATCH /transactions/$T1/status '{"status":"paid","paymentMethod":"cash"}')")"
ok "kemas order offline" 400 "$(c1 <<< "$(req $PKG PATCH /transactions/$T1/fulfillment '{"fulfillmentStatus":"dikemas"}')")"

hdr "BAGIAN 2b — stok tidak boleh bocor kalau transaksi gagal"
SEBELUM_KOPI=$(stok $KOPI)
# item pertama valid, item kedua melebihi stok -> semuanya harus batal
J="{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":1},{\"productId\":\"$ROTI\",\"quantity\":999}]}"
R=$(req $KSR POST /transactions "$J")
ok "order dengan 1 item kurang stok ditolak" 400 "$(c1 <<< "$R")"
ok "stok item yang valid TIDAK ikut kepotong" "$SEBELUM_KOPI" "$(stok $KOPI)"

# ─────────────────────────────────────────────────────────────────────
hdr "BAGIAN 3 — TEMUAN (perilaku apa adanya, buat didiskusikan)"

# 1. produk yang sama ditulis 2x dalam satu order
SEBELUM=$(stok $TEH)
J="{\"items\":[{\"productId\":\"$TEH\",\"quantity\":2},{\"productId\":\"$TEH\",\"quantity\":3}]}"
R=$(req $KSR POST /transactions "$J"); TDUP=$(c2 <<< "$R" | jq -r .data.id)
SESUDAH=$(stok $TEH)
note "produk sama ditulis 2 baris dalam 1 order (2 + 3)" \
     "status $(c1 <<< "$R"), total $(c2 <<< "$R" | jq -r .data.totalAmount), stok $SEBELUM -> $SESUDAH (turun $((SEBELUM-SESUDAH)))"

# 2. cancel order yang barangnya sudah dibawa driver -> HARUS DITOLAK
SEBELUM=$(stok $ROTI)
R=$(req $ADM PATCH /transactions/$T2/status '{"status":"cancelled","cancelReason":"pembeli komplain"}')
ok "cancel order yang sudah 'diambil' ditolak" 400 "$(c1 <<< "$R")"
ok "stok tidak balik ke sistem"      "$SEBELUM" "$(stok $ROTI)"
ok "transaksinya tetap paid"         paid "$($DB "SELECT status FROM transactions WHERE id='$T2';")"

# 2b. cancel order yang baru sampai 'dikemas' -> masih boleh, stok balik
J="{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":4}],\"orderChannel\":\"online\"}"
TK2=$(req $AOL POST /transactions "$J" | c2 | jq -r .data.id)
req $AOL PATCH /transactions/$TK2/status '{"status":"paid","paymentMethod":"transfer"}' > /dev/null
req $PKG PATCH /transactions/$TK2/fulfillment '{"fulfillmentStatus":"dikemas"}' > /dev/null
SEBELUM=$(stok $KOPI)
ok "cancel order yang baru 'dikemas' boleh" 200 \
   "$(c1 <<< "$(req $ADM PATCH /transactions/$TK2/status '{"status":"cancelled","cancelReason":"pembeli batal sebelum diambil"}')")"
ok "stoknya balik" $((SEBELUM+4)) "$(stok $KOPI)"
ok "keluar dari antrian kemasan" "" "$($DB "SELECT coalesce(\"fulfillmentStatus\"::text,'') FROM transactions WHERE id='$TK2';")"
ok "jejak pernah dikemas tetap ada" 1 "$($DB "SELECT count(*) FROM transactions WHERE id='$TK2' AND \"packedAt\" IS NOT NULL;")"

# 3. dua cancel barengan pada transaksi yang sama
J="{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":10}]}"
TR=$(req $KSR POST /transactions "$J" | c2 | jq -r .data.id)
SEBELUM=$(stok $KOPI)
BODY='{"status":"cancelled","cancelReason":"balapan"}'
for n in 1 2 3; do
  curl -s -o "$TMP/c$n" -X PATCH "$B/transactions/$TR/status" -H "Authorization: Bearer $KSR" \
    -H 'content-type: application/json' -d "$BODY" &
done
wait
SESUDAH=$(stok $KOPI)
SUKSES=$(cat "$TMP"/c[123] | grep -o '"success":true' | wc -l | tr -d ' ')
ok "3 cancel barengan: stok cuma balik 1x" $((SEBELUM+10)) "$SESUDAH"
ok "3 cancel barengan: cuma 1 yang sukses"  1 "$SUKSES"

# 3b. dua orang packaging klik "dikemas" barengan pada order yang sama
J="{\"items\":[{\"productId\":\"$KOPI\",\"quantity\":1}],\"orderChannel\":\"online\"}"
TF=$(req $AOL POST /transactions "$J" | c2 | jq -r .data.id)
req $AOL PATCH /transactions/$TF/status '{"status":"paid","paymentMethod":"transfer"}' > /dev/null
for n in 1 2; do
  curl -s -o "$TMP/f$n" -X PATCH "$B/transactions/$TF/fulfillment" -H "Authorization: Bearer $PKG" \
    -H 'content-type: application/json' -d '{"fulfillmentStatus":"dikemas"}' &
done
wait
ok "2 klik 'dikemas' barengan: cuma 1 sukses" 1 "$(cat "$TMP"/f[12] | grep -o '"success":true' | wc -l | tr -d ' ')"

# 4. rebutan barang terakhir
LAST=$(mkprod "Barang Terakhir SIM$S" 5000 1 "SIML$S")
J="{\"items\":[{\"productId\":\"$LAST\",\"quantity\":1}]}"
curl -s -o "$TMP/r1" -X POST "$B/transactions" -H "Authorization: Bearer $KSR" -H 'content-type: application/json' -d "$J" &
curl -s -o "$TMP/r2" -X POST "$B/transactions" -H "Authorization: Bearer $KSR" -H 'content-type: application/json' -d "$J" &
wait
note "2 pembeli rebutan 1 barang terakhir" \
     "yang berhasil: $(cat "$TMP/r1" "$TMP/r2" | grep -o '"success":true' | wc -l | tr -d ' ') dari 2, sisa stok: $(stok $LAST)"

# 5. SO barengan dengan penjualan
RACE=$(mkprod "Adu Cepat SIM$S" 5000 20 "SIMA$S")
JBELI="{\"items\":[{\"productId\":\"$RACE\",\"quantity\":5}]}"
curl -s -o /dev/null -X POST "$B/transactions" -H "Authorization: Bearer $KSR" -H 'content-type: application/json' -d "$JBELI" &
curl -s -o /dev/null -X POST "$B/product/$RACE/stock-adjustments" -H "Authorization: Bearer $GDG" -H 'content-type: application/json' -d '{"stockAfter":20,"reason":"SO barengan penjualan"}' &
wait
note "penjualan 5 pcs barengan dengan SO yang menetapkan stok=20 (awal 20)" \
     "stok akhir: $(stok $RACE) — kalau 20, penjualannya ketimpa SO; kalau 15, urutannya kejaga"

# 6. members cuma urusan penjualan
R=$(req $AOL POST /member/register "{\"name\":\"Tanpa Email$S\",\"phone\":\"0877$S\"}")
ok "member boleh tanpa email"        201 "$(c1 <<< "$R")"
MG=$(c2 <<< "$R" | jq -r '.data[0].id // .data.id')
ok "gudang bikin member ditolak"     403 "$(c1 <<< "$(req $GDG POST /member/register "{\"name\":\"G$S\",\"phone\":\"0899$S\"}")")"
ok "packaging hapus member ditolak"  403 "$(c1 <<< "$(req $PKG DELETE /member/$MG)")"
ok "kasir tetap boleh kelola member" 200 "$(c1 <<< "$(req $KSR GET /member)")"

# 7. admin tidak boleh mengutak-atik role sendiri
AID=$($DB "SELECT id FROM users WHERE email='sim-adm$S@x.com';")
ok "admin ubah role sendiri ditolak" 400 "$(c1 <<< "$(req $ADM PATCH /users/$AID/role '{"role":"kasir"}')")"
ok "rolenya tetap admin" admin "$($DB "SELECT role FROM users WHERE id='$AID';")"
KID=$($DB "SELECT id FROM users WHERE email='sim-ksr$S@x.com';")
ok "admin tetap boleh ubah role orang lain" 200 "$(c1 <<< "$(req $ADM PATCH /users/$KID/role '{"role":"gudang"}')")"
$DB "UPDATE users SET role='kasir' WHERE id='$KID';" > /dev/null

# 8. hapus produk yang sudah pernah dijual
R=$(req $ADM DELETE /product/$TEH)
ok "hapus produk berriwayat ditolak" 400 "$(c1 <<< "$R")"
ok "pesannya menjelaskan sebabnya" "Data ini masih dipakai data lain, tidak bisa dihapus" \
   "$(c2 <<< "$R" | jq -r .error)"

# 9. invoice transaksi batal: tetap keluar, tapi labelnya jujur
R=$(req $ADM GET /transactions/$TK2/invoice)
ok "invoice transaksi cancelled tetap keluar" 200 "$(c1 <<< "$R")"
ok "labelnya 'Batal', bukan 'Belum Dibayar'" Batal "$(c2 <<< "$R" | jq -r .data.statusLabel)"
ok "PATCH /member/:id cuma kirim nama" 200 \
   "$(c1 <<< "$(req $KSR PATCH /member/$MID "{\"name\":\"Budi Ganti$S\"}")")"

# ─────────────────────────────────────────────────────────────────────
hdr "BAGIAN 4 — angka laporan harus benar, bukan cuma 200"

# produk khusus dengan kategori unik biar best-seller bisa diisolasi
LAP=$(req $ADM POST /product "{\"product_name\":\"Laporan SIM$S\",\"price\":1000,\"stock\":100,\"sku\":\"SIMZ$S\",\"category\":\"simlap$S\"}" | c2 | jq -r '.data[0].id')

SB=$(req $ADM GET /transactions/summary | c2)
PC0=$(jq -r '[.data[] | select(.status=="paid") | .count] | add // 0' <<< "$SB")
PT0=$(jq -r '[.data[] | select(.status=="paid") | .total | tonumber] | add // 0' <<< "$SB")
CC0=$(jq -r '[.data[] | select(.status=="cancelled") | .count] | add // 0' <<< "$SB")

# jual 2 pcs -> paid offline (kasir) ; jual 3 pcs -> paid lalu dibatalkan admin
JL="{\"items\":[{\"productId\":\"$LAP\",\"quantity\":2}]}"
TA=$(req $KSR POST /transactions "$JL" | c2 | jq -r .data.id)
req $KSR PATCH /transactions/$TA/status '{"status":"paid","paymentMethod":"cash"}' > /dev/null
JL="{\"items\":[{\"productId\":\"$LAP\",\"quantity\":3}]}"
TB=$(req $KSR POST /transactions "$JL" | c2 | jq -r .data.id)
req $KSR PATCH /transactions/$TB/status '{"status":"paid","paymentMethod":"cash"}' > /dev/null
req $ADM PATCH /transactions/$TB/status '{"status":"cancelled","cancelReason":"tes laporan"}' > /dev/null

SA=$(req $ADM GET /transactions/summary | c2)
PC1=$(jq -r '[.data[] | select(.status=="paid") | .count] | add // 0' <<< "$SA")
PT1=$(jq -r '[.data[] | select(.status=="paid") | .total | tonumber] | add // 0' <<< "$SA")
CC1=$(jq -r '[.data[] | select(.status=="cancelled") | .count] | add // 0' <<< "$SA")
BADCH=$(jq -r '[.data[] | select(.orderChannel!="offline" and .orderChannel!="online")] | length' <<< "$SA")

ok "summary: paid nambah 1 transaksi (yang dibatalkan keluar dari paid)" 1 $((PC1-PC0))
ok "summary: omzet paid nambah 2000, bukan 5000" 2000 $((PT1-PT0))
ok "summary: cancelled nambah 1" 1 $((CC1-CC0))
ok "summary: setiap baris punya orderChannel yang valid" 0 "$BADCH"

BS=$(req $ADM GET "/product/best-seller?category=simlap$S" | c2)
ok "best-seller: yang cancelled tidak dihitung (2, bukan 5)" 2 \
   "$(jq -r --arg p "$LAP" '[.data.items[]? // .data[]? | select(.productId==$p)][0].totalSold // 0' <<< "$BS")"

$DB "DELETE FROM stock_adjustments WHERE \"productId\" IN (SELECT id FROM product WHERE sku LIKE 'SIM%$S');
     DELETE FROM transactions WHERE \"userId\" IN (SELECT id FROM users WHERE email LIKE 'sim-%$S@x.com');
     DELETE FROM product WHERE sku LIKE 'SIM%$S';
     DELETE FROM members WHERE phone IN ('0812$S','0899$S','0877$S');
     DELETE FROM users WHERE email LIKE 'sim-%$S@x.com';" > /dev/null

printf '\n\033[1mpass=%s fail=%s temuan=%s\033[0m\n' "$pass" "$fail" "$findings"
[ "$fail" = 0 ]
