#!/bin/bash
# Smoke test paket A: role & permission + aturan cancel.
# Jalankan dengan dev server + docker-compose hidup: bash scripts/smoke-roles.sh
# User & produk test yang dibuat di sini dihapus lagi di akhir.
B=http://localhost:${PORT:-2080}
DB="docker exec -i my-app-db-1 psql -U postgres -d my_app -tAc"
pass=0; fail=0
chk() { # chk <label> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "  OK   $1"; pass=$((pass+1));
  else echo "  FAIL $1 — expect $2, got $3"; fail=$((fail+1)); fi
}

reg() { # reg <email> <role> -> token
  curl -s -X POST $B/users/register -H 'content-type: application/json' \
    -d "{\"name\":\"$2 test\",\"email\":\"$1\",\"password\":\"rahasia123\"}" > /dev/null
  $DB "UPDATE users SET role='$2' WHERE email='$1';" > /dev/null
  curl -s -X POST $B/users/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"rahasia123\"}" | jq -r .data.token
}
code() { # code <token> <method> <path> [body]
  curl -s -o /dev/null -w '%{http_code}' -X "$2" "$B$3" -H "Authorization: Bearer $1" \
    -H 'content-type: application/json' ${4:+-d "$4"}
}
body() { curl -s -X "$2" "$B$3" -H "Authorization: Bearer $1" -H 'content-type: application/json' ${4:+-d "$4"}; }

S=$RANDOM
ADM=$(reg "adm$S@x.com" admin)
KSR=$(reg "ksr$S@x.com" kasir)
AOL=$(reg "aol$S@x.com" admin_online)
GDG=$(reg "gdg$S@x.com" gudang)
PKG=$(reg "pkg$S@x.com" packaging)

echo "== produk: admin only =="
PID=$(body $ADM POST /product "{\"product_name\":\"Kopi Smoke $S\",\"price\":10000,\"stock\":10,\"sku\":\"SMOKE$S\"}" | jq -r .data[0].id)
chk "admin bisa create produk" true "$([ -n "$PID" ] && [ "$PID" != null ] && echo true)"
chk "kasir create produk ditolak" 403 "$(code $KSR POST /product "{\"product_name\":\"x$S\",\"price\":1,\"stock\":1}")"
chk "gudang delete produk ditolak" 403 "$(code $GDG DELETE /product/$PID)"
chk "gudang boleh lihat produk"    200 "$(code $GDG GET /product)"

echo "== transaksi: akses per role =="
chk "gudang lihat transaksi ditolak" 403 "$(code $GDG GET /transactions)"
chk "kasir lihat transaksi boleh"    200 "$(code $KSR GET /transactions)"

echo "== channel sesuai role =="
J_ONLINE="{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}],\"orderChannel\":\"online\"}"
J_OFFLINE="{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}],\"orderChannel\":\"offline\"}"
chk "kasir bikin order online ditolak" 403 "$(code $KSR POST /transactions "$J_ONLINE")"
chk "admin_online bikin offline ditolak" 403 "$(code $AOL POST /transactions "$J_OFFLINE")"
OID=$(body $AOL POST /transactions "$J_ONLINE" | jq -r .data.id)
chk "admin_online bikin order online boleh" true "$([ "$OID" != null ] && echo true)"

echo "== alur cancel =="
TID=$(body $KSR POST /transactions "{\"items\":[{\"productId\":\"$PID\",\"quantity\":2}]}" | jq -r .data.id)
chk "kasir bikin transaksi offline" true "$([ "$TID" != null ] && echo true)"
# stok 10 - 1 (order online admin_online di atas) - 2 (order ini) = 7
chk "stok kepotong jadi 7" 7 "$($DB "SELECT stock FROM product WHERE id='$PID';")"

chk "cancel tanpa alasan ditolak" 400 "$(code $KSR PATCH /transactions/$TID/status '{"status":"cancelled"}')"
chk "kasir tandai paid" 200 "$(code $KSR PATCH /transactions/$TID/status '{"status":"paid","paymentMethod":"cash"}')"
chk "paidBy tercatat" "$($DB "SELECT id FROM users WHERE email='ksr$S@x.com';")" "$($DB "SELECT \"paidBy\" FROM transactions WHERE id='$TID';")"
chk "kasir cancel yang sudah paid DITOLAK" 403 "$(code $KSR PATCH /transactions/$TID/status '{"status":"cancelled","cancelReason":"iseng"}')"
chk "admin cancel yang sudah paid BOLEH"  200 "$(code $ADM PATCH /transactions/$TID/status '{"status":"cancelled","cancelReason":"pembeli batal, refund tunai"}')"
chk "stok balik jadi 9" 9 "$($DB "SELECT stock FROM product WHERE id='$PID';")"
chk "alasan tersimpan" "pembeli batal, refund tunai" "$($DB "SELECT \"cancelReason\" FROM transactions WHERE id='$TID';")"
chk "cancelledBy tercatat" "$($DB "SELECT id FROM users WHERE email='adm$S@x.com';")" "$($DB "SELECT \"cancelledBy\" FROM transactions WHERE id='$TID';")"
chk "cancelled tidak bisa diubah lagi" 400 "$(code $ADM PATCH /transactions/$TID/status '{"status":"paid","paymentMethod":"cash"}')"

echo "== pending boleh dicancel kasir =="
T2=$(body $KSR POST /transactions "{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}]}" | jq -r .data.id)
chk "kasir cancel pending boleh" 200 "$(code $KSR PATCH /transactions/$T2/status '{"status":"cancelled","cancelReason":"salah input"}')"
chk "stok balik lagi jadi 9" 9 "$($DB "SELECT stock FROM product WHERE id='$PID';")"

echo "== packaging: batas akses =="
chk "packaging bikin transaksi ditolak"  403 "$(code $PKG POST /transactions "$J_ONLINE")"
chk "packaging buka summary ditolak"     403 "$(code $PKG GET /transactions/summary)"
chk "packaging tandai paid ditolak"      403 "$(code $PKG PATCH /transactions/$OID/status '{"status":"paid","paymentMethod":"cash"}')"
chk "packaging lihat antrian boleh"      200 "$(code $PKG GET /transactions)"
chk "packaging buka order offline ditolak" 403 "$(code $PKG GET /transactions/$TID)"
chk "kasir ubah status kemasan ditolak"  403 "$(code $KSR PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"dikemas"}')"

echo "== alur pengemasan =="
chk "order online belum dibayar: belum masuk antrian" "" "$($DB "SELECT coalesce(\"fulfillmentStatus\"::text,'') FROM transactions WHERE id='$OID';")"
chk "belum dibayar tidak bisa dikemas" 400 "$(code $PKG PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"dikemas"}')"
chk "admin_online tandai paid" 200 "$(code $AOL PATCH /transactions/$OID/status '{"status":"paid","paymentMethod":"transfer"}')"
chk "begitu paid otomatis belum_dikemas" belum_dikemas "$($DB "SELECT \"fulfillmentStatus\" FROM transactions WHERE id='$OID';")"
chk "packaging buka order online paid boleh" 200 "$(code $PKG GET /transactions/$OID)"
chk "lompat ke diambil ditolak" 400 "$(code $PKG PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"diambil"}')"
chk "belum_dikemas -> dikemas" 200 "$(code $PKG PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"dikemas"}')"
chk "packedBy tercatat" "$($DB "SELECT id FROM users WHERE email='pkg$S@x.com';")" "$($DB "SELECT \"packedBy\" FROM transactions WHERE id='$OID';")"
chk "dikemas -> diambil" 200 "$(code $PKG PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"diambil"}')"
chk "handedOverBy tercatat" "$($DB "SELECT id FROM users WHERE email='pkg$S@x.com';")" "$($DB "SELECT \"handedOverBy\" FROM transactions WHERE id='$OID';")"
chk "diambil = final, tidak bisa mundur" 400 "$(code $PKG PATCH /transactions/$OID/fulfillment '{"fulfillmentStatus":"dikemas"}')"

echo "== order offline tidak kena alur pengemasan =="
T3=$(body $KSR POST /transactions "{\"items\":[{\"productId\":\"$PID\",\"quantity\":1}]}" | jq -r .data.id)
code $KSR PATCH /transactions/$T3/status '{"status":"paid","paymentMethod":"cash"}' > /dev/null
chk "offline paid tetap tanpa status kemasan" "" "$($DB "SELECT coalesce(\"fulfillmentStatus\"::text,'') FROM transactions WHERE id='$T3';")"
chk "offline tidak bisa dikemas" 400 "$(code $ADM PATCH /transactions/$T3/fulfillment '{"fulfillmentStatus":"dikemas"}')"

# isi listnya, bukan cuma status 200: antrian packaging harus cuma online+paid
IDS=$(body $PKG GET "/transactions?limit=100" | jq -r '.data.items[].id')
chk "antrian packaging berisi order online paid" true "$(grep -q "$OID" <<< "$IDS" && echo true)"
chk "antrian packaging tidak berisi order offline paid" true "$(grep -q "$T3" <<< "$IDS" || echo true)"
chk "kasir tetap lihat order offline" true "$(body $KSR GET "/transactions?limit=100" | jq -r '.data.items[].id' | grep -q "$T3" && echo true)"

echo "== stock opname (gudang) =="
STOK=$($DB "SELECT stock FROM product WHERE id='$PID';")
chk "kasir sesuaikan stok ditolak"  403 "$(code $KSR POST /product/$PID/stock-adjustments '{"stockAfter":5,"reason":"iseng"}')"
chk "penyesuaian tanpa alasan ditolak" 400 "$(code $GDG POST /product/$PID/stock-adjustments '{"stockAfter":5}')"
chk "stok negatif ditolak"          400 "$(code $GDG POST /product/$PID/stock-adjustments '{"stockAfter":-1,"reason":"x"}')"
chk "gudang sesuaikan stok boleh"   201 "$(code $GDG POST /product/$PID/stock-adjustments '{"stockAfter":5,"reason":"rusak 3, hilang 1"}')"
chk "stok produk ikut berubah"      5 "$($DB "SELECT stock FROM product WHERE id='$PID';")"
chk "stockBefore = stok sebelumnya" "$STOK" "$($DB "SELECT \"stockBefore\" FROM stock_adjustments WHERE \"productId\"='$PID';")"
chk "alasan & pelaku tersimpan" "rusak 3, hilang 1|$($DB "SELECT id FROM users WHERE email='gdg$S@x.com';")" \
    "$($DB "SELECT reason||'|'||\"userId\" FROM stock_adjustments WHERE \"productId\"='$PID';")"
chk "gudang lihat riwayat SO"       200 "$(code $GDG GET /product/$PID/stock-adjustments)"
chk "kasir lihat riwayat SO ditolak" 403 "$(code $KSR GET /product/$PID/stock-adjustments)"
chk "riwayat berisi 1 baris"        1 "$(body $GDG GET /product/$PID/stock-adjustments | jq -r .data.total)"

echo "== stok tidak bisa diubah lewat edit produk =="
chk "PATCH produk yang bawa stock ditolak" 400 "$(code $ADM PATCH /product/$PID '{"stock":999,"price":12000}')"
chk "stok tetap 5"    5 "$($DB "SELECT stock FROM product WHERE id='$PID';")"
chk "PATCH tanpa stock tetap jalan" 200 "$(code $ADM PATCH /product/$PID '{"price":12000}')"
chk "harga keupdate" 12000 "$($DB "SELECT price::int FROM product WHERE id='$PID';")"

$DB "DELETE FROM stock_adjustments WHERE \"productId\"='$PID';
     DELETE FROM transactions WHERE \"userId\" IN (SELECT id FROM users WHERE email LIKE '%$S@x.com');
     DELETE FROM users WHERE email LIKE '%$S@x.com';
     DELETE FROM product WHERE sku = 'SMOKE$S';" > /dev/null

echo; echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
