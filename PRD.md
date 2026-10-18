# PRD: UdaKids

Versi 1.3 · 18 Oktober 2026 · Penyusun: Ridho Dwi Syahputra

Nama produk dan maskot ditulis sekali di `apps/web/src/config/app.ts` (`APP_NAME`, `CHARACTER_NAME`).

## 1. Ringkasan

UdaKids adalah aplikasi web belajar untuk anak SD Kelas 1 sampai 4. Anak berlatih soal Matematika dan Sains per topik dan
per level, ditemani robot kecil bernama Momo yang membacakan soal. Orang tua membuat profil anak, memantau laporan, membeli
paket, dan mengunduh sertifikat anak. Admin mengelola buku, topik, level, keluarga, transaksi, Premium, sertifikat, dan
pengaturan aplikasi (batas bayar pesanan, kontak WhatsApp, suara Momo), dibantu Ilustrasi AI untuk gambar materi dan
soal. Aturan level gratis diatur di Silabus Belajar, tempat admin juga menambah buku, topik, dan level baru. Papan
peringkat hanya menampilkan nama panggilan.

Rilis 1.0 memuat **5 buku**: Matematika Kelas 1, 2, 3, 4 dan Sains Kelas 1. Totalnya 50 topik dan 199 level bawaan, soalnya
dibuat generator; level yang ditambah admin memakai bank soal tulisan admin sendiri. Tiga peran (anak, orang tua, admin) saling terhubung penuh. Arsitekturnya monorepo pnpm, React + Vite,
NestJS, Drizzle, PostgreSQL, dan paket `engine` bersama yang dipakai web dan server.

**Posisi saat ini:** tampilan tiga peran telah terhubung ke API NestJS dan PostgreSQL. Mode mock tetap tersedia sebagai demo terpisah. Status gerbang lokal, keterbatasan provider, dan pekerjaan deployment dicatat di [docs/plan.md](docs/plan.md).

## 2. Target User

- Siapa: anak usia 6 sampai 10 tahun (Kelas 1 sampai 4 SD), termasuk yang belum lancar membaca, dan orang tuanya.
- Jenis user:
  - **Anak:** bermain ronde latihan, melihat Peta Belajar, tanaman, peringkat, profil, dan sertifikat. Tidak punya email
    dan tidak punya kata sandi tertulis. Akun anak dibuat oleh orang tua.
  - **Orang tua:** mendaftar, membuat profil anak, memantau laporan, membeli paket, mengunduh dan mencetak sertifikat.
  - **Admin:** staf yang mengelola konten, keluarga, transaksi, Premium, sertifikat, dan pengaturan. Akun admin pertama
    dibuat oleh seed, bukan pendaftaran; admin lain ditambahkan admin di menu Staf. Satu peran admin, tanpa tingkatan.
  - **Pengunjung:** melihat landing, paket, contoh sertifikat, dan 10 besar peringkat, serta mengecek keaslian nomor
    sertifikat.

## 3. Masalah yang Diselesaikan

- Anak kelas awal belum lancar membaca, sedangkan banyak platform soal memakai teks panjang, iklan, dan kata "salah" yang
  membuat anak enggan mencoba.
- Orang tua tidak tahu anaknya kuat atau lemah di topik mana.
- Menulis ratusan soal satu per satu lambat dan cepat membosankan; anak butuh soal yang selalu segar dan sesuai level.
- Akses level berbayar harus terkendali tanpa payment gateway (transfer manual, admin yang memeriksa).
- Anak dan orang tua butuh penanda pencapaian yang nyata saat sebuah buku tuntas, dan sertifikatnya harus tampak resmi
  walau nama panggilan anak pendek.
- Aturan bisnis (batas level gratis, nomor WhatsApp, isi lembar sertifikat) berubah-ubah, jadi admin harus bisa mengubahnya
  tanpa menunggu rilis baru.
- Silabus harus bisa tumbuh: admin perlu menambah buku, topik, dan level baru, lengkap dengan soalnya, tanpa menunggu
  rilis baru.

## 4. Fitur Rilis 1.0 (10 fitur inti)

| No | Fitur                    | Penjelasan singkat |
| -- | ------------------------ | ------------------ |
| 1  | Akun dan tiga peran      | Orang tua daftar (email + kata sandi, wajib centang persetujuan) dan mendapat kode keluarga 6 huruf. Orang tua membuat maksimal 3 profil anak (nama panggilan, warna Momo, sandi 3 gambar). Anak masuk dengan kode keluarga + sandi gambar. Admin masuk lewat halaman staf. Orang tua punya halaman akun (nama, kata sandi, email dengan kode konfirmasi). |
| 2  | Belajar terstruktur      | 5 buku, 10 topik per buku, 4 level per topik (topik pertama Sains Kelas 1 berisi 3 level). Semua topik terbuka sejak awal; di dalam topik level berurutan. Awalnya level 1 dan 2 gratis, level 3 dan 4 Premium; batasnya diatur admin di Silabus Belajar. Admin bisa menambah buku, topik, dan level baru; levelnya bisa dimainkan setelah soalnya ditulis. Beranda anak berupa **Peta Belajar**: pilihan Kelas 1 sampai 4, jalur topik per buku, dan panel topik (pengantar yang bisa didengar, "Tahukah kamu?", kemajuan, Mulai belajar). Kartu Premium muncul setelah level gratis topik itu lulus. |
| 3  | Ronde latihan            | 10 soal dibuat generator di `engine` dari seed ronde (deterministik), atau diambil acak dari bank soal tulisan admin bila admin menyesuaikan soal level itu (tetap 10 soal per ronde, deterministik dari seed). Jenis soal: pilihan ganda, isian angka, benar/belum tepat. Pilihan langsung dinilai saat diketuk; isian angka memakai `Keypad` dan tombol periksa. Umpan balik hijau/kuning dengan petunjuk langsung dibacakan, stopwatch tanpa batas, 10 titik indikator, lalu halaman hasil. **Dinilai di server.** |
| 4  | Skor Jago dan tanaman    | Skor penguasaan per topik (0 sampai 100), diperbarui tiap jawaban. Anak hanya melihat tanaman 4 tahap (benih, tunas, pohon, berbuah). Orang tua dan admin melihat angka dan status (Belajar, Bisa, Jago). |
| 5  | Papan peringkat          | Tiga mode: Rata-rata (tertimbang), Total Skor, dan Mock Test (disiapkan, belum berisi). Total dan per buku. Hanya nama panggilan dan warna Momo yang terlihat. Posisi anak sendiri disorot. 10 besar tampil di landing. |
| 6  | Laporan orang tua        | Dasbor keluarga (ringkasan minggu, progres tiap anak dan tiap buku, level berikutnya, topik terkuat dan yang perlu ditemani), laporan per anak, dan kartu sertifikat. |
| 7  | Paket dan pembayaran     | 5 paket: Tunas (30 hari), Kumbang (90), Tumbuh Bersama (180), Bintang Kecil (365), Teman Setia (selamanya). Orang tua memilih paket dan cara bayar (BCA, BNI, CIMB Niaga, Gopay, ShopeePay), mentransfer total dengan kode unik Rp1 sampai Rp499, lalu mengunggah bukti. Admin menyetujui atau menolak dengan catatan. Premium berlaku untuk semua anak di keluarga itu. Tanpa perpanjangan otomatis. Tombol WhatsApp admin di semua halaman. Paket dan rekening bisa ditambah, diubah, dinonaktifkan, atau dihapus admin; harga di landing dan area orang tua mengikuti menu Paket, dan nomor WhatsApp mengikuti Pengaturan. |
| 8  | Panel admin              | **Ringkasan** (angka utama, tingkat lulus ronde, catatan tindak lanjut, grafik belajar dan penjualan, kelulusan per buku, pesanan terbaru). **Konten & Kurikulum:** Silabus Belajar (tambah buku, topik, dan level; materi, "Tahukah kamu?", judul level; aturan akses berbayar dan level gratis; pengecualian gratis/Premium per level; bank soal tulisan admin untuk level buatan sendiri), Bank Soal & Latihan (simulator kuis seperti anak dan kunci jawaban per seed), Sertifikat Juara. **Media & Audio:** Galeri Aset, Audio Narasi (suara Momo), Ilustrasi AI (gambar dengan antrean tinjau). **Pengguna & Akademik:** Keluarga & Anak, Tim Staf & Akses, Laporan & Rapor Belajar. **Langganan & Pembayaran:** Transaksi & Bukti Bayar, Paket Langganan, Rekening & Pembayaran, Pengaturan Sistem. Lonceng notifikasi di kanan atas. Aturan Pengaturan di bagian 4.3. |
| 9  | Sertifikat Juara Digital | Bagian dari Premium. Anak yang lulus semua level dalam satu buku mendapat sertifikat bernomor (`CERT-XXXXXX`) yang terbit otomatis. Anak melihat dan mencetaknya; orang tua mengunduh gambar PNG atau mencetak/menyimpan PDF dan bisa mengisi nama lengkap anak khusus untuk sertifikat; admin mengelola desain, isi lembar, daftar menunggu, dan semua sertifikat. Setiap lembar punya kode QR ke halaman publik cek keaslian. Aturan lengkap di bagian 4.2. |
| 10 | Suara                    | Setiap halaman anak membacakan isinya begitu tampil, tombol dan tautan menyebut namanya saat diketuk, soal dan umpan balik dibacakan tanpa jeda. Admin mengatur suara di Audio Narasi: hidup/mati, bacaan otomatis, kecepatan, nada, dan suara yang diutamakan. Mode tiruan memakai suara peramban berbahasa Indonesia. M10 menambah klip Google Cloud Text-to-Speech (`id-ID-Chirp3-HD-Leda`) untuk soal dan materi, dibuat sekali dan disimpan di PostgreSQL. Simbol matematika dibacakan sebagai kata bahasa Indonesia (`>` "lebih dari", `<` "kurang dari", `=` "sama dengan", `â‰ ` "tidak sama dengan", `+` "tambah", `-` "kurang", `Ã—` "kali", `Ã·` "bagi") karena mesin suara peramban melewatkannya. Tanpa suara, teks tetap tampil. |

### 4.1 Aturan nilai

- **Ronde:** 10 soal, tiap soal dinilai sekali. Skor = benar / 10 Ã— 100. Lulus bila skor â‰¥ 70 **dan** keliru â‰¤ 3.
  Ambang, jumlah soal per ronde, dan batas keliru disimpan per level.
- **Level:** semua topik boleh dipilih bebas. Di dalam topik, level 1 selalu terbuka dan level berikutnya terbuka bila
  level sebelumnya pernah lulus.
- **Premium:** level berbayar hanya bisa dimainkan bila anak punya Premium aktif, dari paket keluarga atau dari admin.
  Level gratis: nomor level â‰¤ `freeLevels` di Silabus Belajar (awalnya 2, nilai awal `FREE_LEVELS` di `engine`), kecuali
  admin mengecualikan satu level di topiknya (level 1 selalu gratis). Kunci berbayar bisa dimatikan: semua level
  gratis. Yang berlaku adalah tanggal berakhir Premium yang paling akhir. Dicek di server.
- **Skor Jago:** tahap tanaman yang sudah terlihat tidak pernah turun. Kekeliruan di mode tantangan tidak menghukum.
- **Peringkat:** total skor = jumlah skor terbaik tiap level, seri dipecah dengan total waktu lebih cepat. Mode Rata-rata
  memakai rata-rata tertimbang dengan 5 ronde awal bernilai 70.

### 4.2 Aturan Sertifikat Juara Digital

- **Syarat:** semua level dalam satu buku pernah lulus dan Premium aktif. Satu anak mendapat paling banyak satu sertifikat
  per buku. Buku tanpa level tidak menghasilkan sertifikat.
- **Terbit otomatis:** saat ronde yang menuntaskan buku itu lulus, server langsung menerbitkan sertifikat (cara terbit
  `auto`) dan halaman hasil merayakannya dengan tombol "Lihat sertifikat".
- **Tertunda:** bila buku tuntas ketika Premium tidak aktif, statusnya "Perlu Premium". Anak melihat ajakan meminta orang
  tua (tanpa harga), orang tua melihat tombol Lihat paket. Setelah Premium aktif, anak menekan "Ambil sertifikatku" atau
  orang tua menekan "Terbitkan sekarang" (cara terbit `claim`). Admin bisa menerbitkannya langsung dari daftar Menunggu,
  walau Premium tidak aktif (cara terbit `admin`).
- **Nomor:** `CERT-` diikuti 6 karakter dari `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (tanpa I, O, 0, dan 1 agar tidak
  tertukar), dibuat dari sumber acak dan dijamin unik.
- **Isi lembar (A4 mendatar):** kepala (penerbit dan kalimat kecil), judul dan sub-judul, nama di sertifikat, kalimat
  pujian usaha ("atas ketekunannya berlatih dan menyelesaikan seluruh 40 level di 10 topik buku"), judul buku, baris
  keterangan (kurikulum dan rata-rata skor, bila diaktifkan), satu penanda tangan di kanan bawah (tanda tangan di atas
  garis, nama, dan jabatan), stempel digital resmi (segel emas dengan nama penerbit dan "JUARA") di samping tanda tangan
  bila dinyalakan, kode QR, tanggal terbit, dan nomor sertifikat. Teks tetap lembar (penerbit, judul, penanda tangan,
  kurikulum, tampil/sembunyi skor, QR, dan stempel) dari Pengaturan, bukan tertulis di kode; awalnya "UdaKids Â· Belajar
  bersama Momo", "SERTIFIKAT Juara Digital", dan Tim UdaKids (Pengelola). Tanpa data pribadi lain.
- **Tanda tangan:** tiga pilihan di dialog Atur isi lembar. *Goresan bawaan* (bentuk tetap); *Tulis / gambar* (kanvas
  350 Ã— 120 yang bisa digores dengan mouse atau sentuhan, hasilnya PNG transparan yang langsung tampil di pratinjau);
  *Unggah foto / scan* (PNG, JPG, atau WebP sampai 5 MB). Foto yang diunggah diperiksa: tolak bila hampir tanpa tinta
  (kurang dari 0,5% piksel gelap) atau hampir seluruhnya gelap (lebih dari 70%, seperti foto biasa); piksel latar
  terang (kecerahan di atas 220) dijadikan transparan dengan tepi dilunakkan, gambar dipotong rapat ke goresan dan
  dikecilkan sampai muat di 700 Ã— 240. Hasilnya disimpan sebagai Data URL PNG, JPG, atau WebP (SVG ditolak) paling
  banyak 300.000 karakter. Gambar tiap pilihan diingat selama dialog terbuka.
- **Stempel digital:** kotak centang "Pasang stempel digital resmi" memunculkan dua sumber. *Gunakan stempel yang sudah
  ada*: dropdown berisi segel emas bawaan (nama penerbit dan "JUARA") dan riwayat stempel yang pernah diunggah.
  *Unggah stempel baru*: PNG transparan, JPG, atau WebP sampai 5 MB (dikecilkan paling besar 480 px, ditolak bila kosong),
  diberi nama; stempel baru masuk riwayat (paling banyak 12, bisa dihapus dari riwayat) saat pengaturan disimpan, jadi
  admin lain atau sesi berikutnya bisa memilihnya lagi. Pratinjau lembar langsung memakai pilihan itu. Gambar stempel
  dipakai menggantikan segel bawaan (`certificate.stampImage`) dan ikut tergambar di unduhan PNG.
- **Nama di sertifikat:** nama panggilan sering pendek atau lucu, sehingga lembarnya kurang meyakinkan. Orang tua boleh
  mengisi nama lengkap anak khusus untuk sertifikat (2 sampai 60 huruf; huruf, spasi, titik, tanda petik, tanda hubung) di
  formulir ubah anak atau di halaman Sertifikat. Karena itu data pribadi anak, mengisinya pertama kali butuh centang
  persetujuan orang tua, disimpan bersama waktunya, dan bisa dihapus dengan mengosongkan isian. Nama ini hanya tampil di
  lembar; aplikasi dan papan peringkat tetap memakai nama panggilan. Bila Pengaturan "Pakai nama lengkap" dimatikan,
  semua sertifikat memakai nama panggilan dan isian itu disembunyikan.
- **Cek keaslian (publik):** kode QR di lembar membuka `/sertifikat/cek/:id`. Pengunjung juga bisa mengetik nomornya di
  `/sertifikat/cek`. Hasilnya menyatakan asli atau tidak terdaftar, dengan buku, capaian, tanggal terbit, penerbit, dan
  nama yang disamarkan (huruf pertama tiap kata, mis. "A** L******"); nama lengkap anak tidak pernah terbuka. Contoh lembar
  (belum terbit) tidak memuat QR.
- **Data tetap:** nama di sertifikat, judul buku, jumlah topik, jumlah level, dan rata-rata skor terbaik level buku itu
  disalin saat terbit. Nama di sertifikat ikut berubah bila orang tua mengubah nama lengkap, mengganti nama panggilan
  (saat belum ada nama lengkap), atau admin mengubah aturan "Pakai nama lengkap"; nomor dan tanggal terbit tidak berubah.
  Admin bisa menekan "Perbarui" untuk memakai nama dan desain terbaru. Admin bisa menghapus sertifikat; bila anak tetap
  lulus semua level, ia kembali ke daftar Menunggu. Menghapus profil anak ikut menghapus sertifikatnya.
- **Desain:** tiga desain bawaan yang di menu admin bernama Kuning, Merah, dan Hijau (kode di data: `klasik`, `gonjong`,
  `sawah`), dengan bingkai ganda dan pita rebung. Admin memilih satu; desain itu dipakai untuk sertifikat yang terbit berikutnya.
- **Unduh dan cetak:** orang tua dan admin mengunduh gambar PNG (2246 Ã— 1588 piksel) atau mencetak/menyimpan PDF lewat
  dialog cetak (satu halaman A4 mendatar, hanya lembar sertifikat). Anak hanya punya tombol Cetak.
- **Terlihat di:** Peta Belajar (kemajuan level menuju sertifikat buku yang sedang dibuka), halaman hasil ronde, Profil
  anak (Sertifikatku), menu Sertifikat dan kartu dasbor orang tua, laporan anak, halaman paket, panel admin, dan landing
  (contoh lembar).

### 4.3 Pengaturan admin

Kartu **Akses berbayar** di Silabus Belajar (`/admin/konten`, kunci berbayar dan level gratis di bagian `billing`), menu
**Pengaturan Sistem** (`/admin/pengaturan`, batas bayar pesanan di bagian `billing`, dan bagian `contact`), dialog **Atur
isi lembar** di Sertifikat Juara (`/admin/sertifikat`, bagian `certificate`), dan **Audio Narasi** (`/admin/narasi`, bagian
`voice`) menyimpan nilai yang dulu tertulis di kode. Semua halaman membaca nilai yang
sama lewat `useSettings()`, sehingga perubahan langsung berlaku tanpa memuat ulang. Tiap bagian disimpan sendiri (`PUT
/admin/settings/:part`) dan diperiksa skema di `engine`; isian yang keliru ditolak per isian.

| Bagian       | Isian | Dipakai di |
| ------------ | ----- | ---------- |
| `billing`    | Kunci berbayar (hidup/mati) dan level gratis per topik (1 sampai 12, awalnya 2), diatur di Silabus Belajar; batas bayar pesanan (1 sampai 168 jam, awalnya 24), diatur di Pengaturan Sistem. Menyimpan satu isian tidak mengubah yang lain | Status level anak, landing, halaman Paket dan Silabus Belajar admin, masa berlaku pesanan baru |
| `contact`    | Nomor atau link WhatsApp admin (nomor HP 08â€¦ diubah menjadi `https://wa.me/62â€¦`, hanya domain WhatsApp), pesan pembuka (maks 200 huruf), link grup WhatsApp orang tua (hanya `chat.whatsapp.com`, opsional) | Tombol "Hubungi admin" (kosong berarti tombol disembunyikan), halaman Paket orang tua |
| `certificate`| Penerbit, kalimat kecil kepala, judul, sub-judul, satu penanda tangan beserta jabatannya, jenis tanda tangan (`default`, `draw`, `upload`) dan gambarnya, pasang stempel digital dan gambar stempel sendiri (`stampImage`, kosong memakai segel bawaan), keterangan kurikulum, tampilkan rata-rata skor, tampilkan kode QR, pakai nama lengkap dari orang tua | Lembar sertifikat (anak, orang tua, admin, landing), halaman cek keaslian |
| `voice`      | Suara aktif, bacakan otomatis saat halaman/soal tampil, kecepatan (0,6 sampai 1,4, awalnya 0,92), nada (0,5 sampai 1,5, awalnya 1,1), suara peramban yang diutamakan. Diatur di menu Audio Narasi | Semua suara di area anak; pratinjau admin memakai isian yang belum disimpan |

Dialog Atur isi lembar (latar gelap pekat, tanpa buram supaya gulir tetap ringan) menampilkan pratinjau lembar langsung dari isian (data contoh) sebelum
disimpan; Simpan menutup dialog dan ringkasan "Lembar yang berlaku" langsung memakai isi baru, Batal tidak menyimpan
apa pun. Pilihan desain ada di halaman yang sama. Pengecualian per level ada di topiknya di Silabus Belajar dan ditandai
"Pengecualian"; pengecualian yang kembali sama dengan aturan akses otomatis dihapus.

### 4.4 Interaksi antar peran

1. Orang tua mendaftar, membuat profil anak dan sandi gambar, lalu mendapat kode keluarga.
2. Anak masuk dengan kode keluarga dan sandi gambar itu, lalu bermain.
3. Setiap ronde tersimpan, sehingga laporan orang tua, Skor Jago, papan peringkat, dan statistik admin ikut berubah.
4. Orang tua membeli paket dan mengunggah bukti transfer. Admin menyetujui, lalu level berbayar di semua topik terbuka
   untuk semua anak di keluarga itu. Admin juga bisa memberi atau mencabut Premium per anak tanpa transaksi.
5. Admin mengubah judul, materi, atau status level. Perubahan langsung terlihat di area anak. Soal level bawaan dibuat
   generator, jadi tidak perlu ditinjau satu per satu; admin boleh menyesuaikan soal level mana pun (disalin dari generator
   menjadi bank soal yang diedit, anak tetap mengerjakan 10 soal per ronde). Admin juga menambah buku, topik, dan level;
   level baru langsung bisa dimainkan anak begitu bank soalnya (minimal 4 soal) disimpan.
6. Anak menuntaskan sebuah buku. Sertifikat terbit, tampil di halaman hasil dan Profil anak, di menu Sertifikat orang tua,
   dan di panel admin. Orang tua bisa mengisi nama lengkap anak agar lembarnya resmi; siapa pun bisa mencocokkan nomornya
   di halaman cek keaslian.
7. Admin mengubah aturan level gratis (Silabus Belajar), WhatsApp (Pengaturan), atau isi lembar sertifikat. Anak, orang tua, dan pengunjung
   langsung melihat perubahannya. Admin menonaktifkan akun anak atau keluarga; akun itu tidak bisa masuk dan tersembunyi dari pilihan
   profil sampai diaktifkan lagi.

## 5. Peta Jalan (setelah rilis 1.0)

Hal berikut **tidak** dibangun di rilis 1.0. Struktur data dan modul disiapkan agar bisa ditambah nanti.

- Jenjang lain (PAUD, TK, Kelas 5 dan 6, olimpiade), Sains Kelas 2 sampai 4, dan mapel lain (literasi).
- Mock test (mode peringkatnya sudah disiapkan) dan buku 10 level per topik.
- Petualangan Momo (puzzle kartu perintah), lab, simulasi, dan game.
- Payment gateway dan perpanjangan otomatis. Halaman afiliasi (endpoint referral sudah ada, menunya dihapus).
- Fasilitator, kelas, dan lomba live.
- Login Google dan lupa kata sandi. Verifikasi email saat daftar disiapkan di backend, bawaan mati; UI verifikasi belum masuk rilis. Email transaksi memakai outbox server.
- Mode offline/PWA dan antrean sinkronisasi (outbox).
- Data realtime (SSE dan polling). Rilis 1.0 memuat data saat halaman dibuka.
- Foto nyata (Pexels) dan penyaringan foto dengan AI.
- Hias Momo (aksesori) dan mode gelap. Rilis 1.0 cukup warna Momo dan tema terang.
- Sertifikat lanjutan: unggah latar sertifikat oleh admin dan lencana per topik.
- Peran staf bertingkat (rilis 1.0 hanya satu peran admin) dan catatan aktivitas admin.
- Hapus akun orang tua secara mandiri (hapus profil anak sudah ada).

## 6. Alur User

### Orang tua

1. Buka landing `/`, klik "Daftar sebagai orang tua", isi nama, email, kata sandi (min 8), centang persetujuan data nama
   panggilan anak. Setelah daftar langsung masuk ke dasbor dan kode keluarga tampil.
2. Klik "Tambah profil anak": nama panggilan (2 sampai 20 huruf), warna Momo (6 pilihan), dan sandi 3 gambar dari 9
   gambar (ulangi untuk konfirmasi).
3. Beri tahu anak kode keluarga (ada tombol Salin). Anak bermain di `/play/masuk`.
4. Dasbor: ringkasan minggu ini dan progres tiap anak (per buku, level berikutnya, topik terkuat, topik yang perlu
   ditemani). Buka laporan anak untuk Skor Jago per topik, ketepatan, ronde terakhir, saran topik, dan kemajuan sertifikat.
5. Buka **Paket & Pembayaran**: pilih paket, pilih cara bayar, buat pesanan, transfer sesuai total (3 digit terakhir kode
   unik), unggah bukti. Pantau di **Riwayat Transaksi**; pesanan yang perlu tindakan diberi angka di menu.
6. Buka **Sertifikat**: lihat sertifikat yang sudah terbit per anak, kemajuan tiap buku, dan contoh lembar. Bila lembar
   masih memakai nama panggilan, isi nama lengkap anak di sana (dengan centang persetujuan); nama itu juga bisa diubah di
   formulir ubah anak. Buka satu sertifikat untuk mengunduh gambar atau mencetak/menyimpan PDF dan melihat tautan cek
   keaslian. Sertifikat yang tertunda bisa diterbitkan setelah Premium aktif.

### Anak

1. Buka `/play/masuk`, ketik kode keluarga 6 huruf, pilih kartu profil (nama + Momo), ketuk 3 gambar sandi.
2. Beranda: tombol besar Lanjutkan, pilihan Kelas 1 sampai 4, pilihan Matematika/Sains, lalu Peta Belajar buku itu.
   Kartu ringkasan menautkan sertifikat buku ("Sertifikat: 12 dari 40 level lulus").
3. Ketuk topik di peta: dengarkan pengantar dan "Tahukah kamu?", lalu Mulai belajar ke halaman topik. Level punya 5
   keadaan: lulus, terbuka, terkunci (level sebelumnya belum lulus), Premium (kartu untuk anak dan langkah untuk orang
   tua, tanpa harga), dan segera hadir.
4. Main ronde: 10 soal, tiap soal dibacakan otomatis. Ketuk jawaban, umpan balik hijau atau kuning dengan petunjuk langsung
   terdengar, ketuk "Lanjut".
5. Halaman hasil: skor, "8 dari 10 benar", waktu, pujian usaha. Lulus: "Lanjut level berikutnya". Belum lulus: "Coba lagi"
   dengan soal diacak ulang. Bila ronde menuntaskan buku: "Hore! Kamu dapat sertifikat!".
6. Profil: statistik, warna Momo, Sertifikatku (satu kartu per buku), dan riwayat bermain. Papan peringkat dari beranda.

### Admin

1. Masuk di `/masuk/staf`. Ringkasan: 8 angka utama (anak aktif, soal dijawab, ronde lulus, pendapatan, bukti menunggu,
   anak Premium, sertifikat, sedang bermain), catatan tindak lanjut bertautan (bukti menunggu, sertifikat menunggu,
   ilustrasi menunggu tinjau, level tersulit), grafik aktivitas, pendapatan, corong keluarga, jam ramai (24 jam penuh, 00 sampai 23 WIB, dengan popover rincian per kotak),
   kelulusan per buku,
   level tersulit, jawaban keliru terbanyak, dan pesanan terbaru. Rentang 7 hari, 30 hari, atau bulan ini.
2. Silabus Belajar: kartu **Akses berbayar** (kunci berbayar hidup/mati dan jumlah level gratis per topik, dengan contoh
   satu topik); di bawahnya tiap buku bisa dilipat. **Tambah buku** membuat buku untuk satu pasangan mapel dan kelas yang
   belum ada, langsung dengan topik pertamanya. Mapel tidak dibatasi: dropdown menawarkan Matematika, Sains, Bahasa
   Inggris, mapel lain yang sudah punya buku, dan "+ Tambah mata pelajaran lainnyaâ€¦" untuk menulis nama mapel baru (mis.
   Coding, Seni Budaya); mapel baru memberi alamat buku seperti `seni-budaya-kelas-5` dan otomatis ada di dropdown pada
   buku berikutnya. **Tambah topik** menambah topik (kode, judul, materi, "Tahukah kamu?", level).
   Topik dibuka untuk mengubah judul, materi, judul level, dan akses tiap level (Gratis/Premium; yang menyimpang dari
   aturan ditandai "Pengecualian"), menambah level di akhir (paling banyak 12), dan menghapus topik atau level buatan admin
   yang belum dikerjakan anak. Level buatan admin memakai **bank soal tulisan admin**: pertanyaan dan pilihan jawaban,
   satu jawaban benar, petunjuk (minimal 4 soal, 10 atau lebih supaya jarang berulang); satu ronde mengambil 10 soal
   dengan urutan pilihan diacak. Level tanpa soal tampil "Segera hadir" di area anak. Buku, topik, dan level bawaan tidak bisa
   dihapus. **Soal di semua level bisa disesuaikan:** tombol "Sesuaikan soal" di level otomatis membuka dialog bank soal
   berisi 20 soal contoh dari generator level itu (bisa diambil ulang dengan "Ambil contoh baru"); soal isian angka menjadi
   pilihan ganda, gambar benda hitung ikut tersalin. Admin mengubah kalimat, pilihan, jawaban benar, dan petunjuk, lalu
   menyimpan; gambar tiap soal juga bisa diubah (benda hitung: jenis benda dan jumlahnya, hingga tiga kelompok; gambar dari
   Galeri Aset atau Ilustrasi AI yang disetujui; unggahan sendiri PNG, JPG, atau WebP sampai 3 MB; atau tanpa gambar); sejak itu level memakai bank tersebut, dan "Kembalikan ke soal bawaan" memulihkan generator aslinya. Level
   yang ruang soalnya kecil bisa menghasilkan kurang dari 20 soal berbeda.
3. Bank Soal & Latihan: pilih buku, topik, level, dan seed. Mode simulasi memutar ronde 10 soal seperti anak (dibacakan,
   dijawab, umpan balik dan petunjuk, hasil lulus/belum); mode kunci menampilkan 10 soal beserta jawaban dan petunjuk.
   Tidak menyimpan apa pun.
4. Media & Audio: Galeri Aset menampilkan semua gambar (benda soal dengan jumlah level pemakainya, sandi gambar, Momo,
   tanaman, desain sertifikat, ilustrasi yang disetujui) dan bisa diunduh sebagai SVG. Audio Narasi mengatur suara Momo,
   menguji suara, dan memutar semua materi serta "Tahukah kamu?". Ilustrasi AI menerima permintaan gambar (benda, adegan,
   karakter Momo; latar; jumlah benda; varian) dengan pratinjau; hasilnya ditinjau (setujui, tolak, hapus) sebelum tampil
   di Galeri.
5. Keluarga: ringkasan angka, tab Keluarga dan Anak, cari, saring (Free/Premium, aktif/nonaktif), urutkan, dan paging.
   Per anak: beri atau cabut Premium dengan masa berlaku dan catatan (tanpa transaksi), atur ulang sandi gambar,
   nonaktifkan, atau buka laporannya. Per keluarga: nonaktifkan akun atau atur kata sandi baru. Staf: tambah admin lain,
   atur kata sandi, nonaktifkan (akun yang sedang dipakai tidak bisa dinonaktifkan).
6. Transaksi: saring menurut status, periksa bukti transfer, setujui atau tolak dengan catatan; lencana di menu menghitung
   pesanan yang menunggu verifikasi. Paket dan Rekening: tambah, ubah (nama, keterangan, harga normal, harga jual, masa
   aktif, status, urutan), nonaktifkan, atau hapus; paket yang sudah pernah dipesan hanya dinonaktifkan.
7. Sertifikat Juara: lihat lembar yang berlaku (teks lembar, kode QR, aturan nama lengkap) dengan contoh, ubah isinya
   lewat dialog Atur isi lembar dengan pratinjau langsung, pilih desain, terbitkan dari daftar Menunggu, cari sertifikat terbit (nama di lembar: lengkap atau panggilan),
   lihat/unduh/cetak, buka cek keaslian, perbarui, atau hapus (konfirmasi mengetik "hapus").
8. Laporan: statistik per level (tingkat lulus, jawaban keliru terbanyak) dan laporan per anak (Skor Jago, topik yang
   perlu ditemani, kemajuan tiap buku).
9. Pengaturan Sistem: ubah batas bayar pesanan dan kontak WhatsApp (bagian 4.3); di mode
   tiruan juga muat ulang atau hapus data contoh. Lonceng di pojok kanan atas memuat 30 kabar terakhir.
10. Semua daftar memakai pola yang sama: chip saring berwarna status (kuning menunggu, hijau lunas/disetujui, merah
    ditolak) dengan jumlah per status, badge status satu ukuran, dan tombol aksi ringkas yang menempati kolom tetap sehingga
    sejajar antarbaris.
11. Semua pilihan satu dari beberapa memakai dropdown bergaya (bukan daftar bawaan peramban) yang bisa dipakai dengan
    papan ketik; sakelar, pilihan segmen, stepper, kotak centang, dan bulatan pilihan juga bergaya seragam.
12. Pertanyaan "yakin?" sebelum aksi yang tidak bisa dibatalkan (hapus paket, rekening, ilustrasi, atau data contoh,
    setujui pembayaran, tutup dialog soal yang belum disimpan, ganti soal dengan contoh baru) tampil sebagai pop-up
    bergaya aplikasi dengan dua pilihan jelas ("Ya, ..." dan "Tidak"), bukan kotak bawaan peramban ("localhost says").
    Esc atau ketuk di luar kotak sama dengan "Tidak"; fokus awal ada di pilihan yang aman.

## 7. Daftar Halaman

Router: React Router 6. Bagian dinamis ditulis `:param`. URL halaman berbahasa Indonesia, semua teks UI lewat i18n.

| Halaman             | URL                           | Isi                                                                                   | Perlu login? |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------- | ------------ |
| Landing             | `/`                           | Navbar, hero, fitur, kurikulum, fitur terbaru (paket, keluarga, contoh sertifikat), harga, 10 besar | Tidak        |
| Cek keaslian        | `/sertifikat/cek`, `/sertifikat/cek/:id` | Ketik nomor sertifikat atau pindai QR; hasil asli atau tidak terdaftar dengan nama disamarkan | Tidak        |
| Gaya (dev)          | `/gaya`                       | Katalog token dan komponen, setel ulang data tiruan, bantuan demo sertifikat. Hanya saat `import.meta.env.DEV` | Tidak        |
| Masuk anak          | `/play/masuk`                 | Kode keluarga, pilih profil, sandi gambar                                             | Tidak        |
| Beranda anak        | `/play`                       | Lanjutkan, pilihan kelas dan mapel, Peta Belajar, tautan sertifikat buku              | Anak         |
| Buku (alamat lama)  | `/play/buku/:slug`            | Dialihkan ke Peta Belajar `/play` dengan buku itu terpilih                            | Anak         |
| Topik               | `/play/topik/:id`             | Materi (dibacakan), contoh soal, 4 kartu level, kartu Premium. Tombol kembali membuka Peta Belajar buku topik itu | Anak         |
| Ronde               | `/play/latihan/:levelId`      | Pemain soal (alamat lama `/play/main/:levelId` dialihkan ke sini)                     | Anak         |
| Hasil               | `/play/hasil/:roundId`        | Skor, benar, waktu, pujian, sertifikat baru, tombol lanjut atau coba lagi             | Anak         |
| Peringkat anak      | `/play/peringkat`             | Tiga mode, total dan per buku, sorot diri sendiri                                     | Anak         |
| Profil anak         | `/play/profil`                | Statistik, warna Momo, Sertifikatku, riwayat                                          | Anak         |
| Sertifikat anak     | `/play/sertifikat/:bookSlug`  | Lembar dan tombol Cetak, atau Ambil sertifikatku, Perlu Premium, atau kemajuan + contoh lembar | Anak         |
| Daftar orang tua    | `/orang-tua/daftar`           | Nama, email, kata sandi, centang persetujuan                                          | Tidak        |
| Masuk orang tua     | `/orang-tua/masuk`            | Email + kata sandi                                                                    | Tidak        |
| Dasbor orang tua    | `/orang-tua`                  | Ringkasan minggu, progres anak, kode keluarga, kartu paket, kartu sertifikat          | Orang tua    |
| Tambah anak         | `/orang-tua/anak/baru`        | Nama panggilan, warna Momo, sandi gambar                                              | Orang tua    |
| Laporan anak        | `/orang-tua/anak/:id`         | Skor Jago per topik, ketepatan, ronde terakhir, sertifikat, saran                     | Orang tua    |
| Ubah anak           | `/orang-tua/anak/:id/ubah`    | Ubah nama/warna, nama lengkap untuk sertifikat (opsional, dengan persetujuan), hapus anak (konfirmasi) | Orang tua    |
| Sandi gambar        | `/orang-tua/anak/:id/sandi`   | Atur ulang sandi 3 gambar                                                             | Orang tua    |
| Sertifikat          | `/orang-tua/sertifikat`       | Sertifikat terbit per anak, isian nama lengkap, kemajuan tiap buku, contoh lembar, terbitkan yang tertunda | Orang tua    |
| Satu sertifikat     | `/orang-tua/sertifikat/:id`   | Lembar, unduh PNG, cetak/simpan PDF, keterangan, tautan cek keaslian                  | Orang tua    |
| Paket & Pembayaran  | `/orang-tua/paket`            | Level gratis, tautan grup WhatsApp (bila diisi), paket aktif, pilihan paket, pilih cara bayar | Orang tua    |
| Riwayat Transaksi   | `/orang-tua/transaksi`        | Daftar pesanan dan statusnya                                                          | Orang tua    |
| Detail pesanan      | `/orang-tua/transaksi/:id`    | Jumlah transfer, rekening tujuan, unggah bukti, batalkan                              | Orang tua    |
| Akun saya           | `/orang-tua/akun`             | Nama, kata sandi, email dengan kode konfirmasi                                        | Orang tua    |
| Masuk staf          | `/masuk/staf`                 | Email + kata sandi admin                                                              | Tidak        |
| Ringkasan           | `/admin`                      | Angka utama, catatan tindak lanjut, grafik belajar dan penjualan, kelulusan per buku, pesanan terbaru | Admin        |
| Silabus Belajar     | `/admin/konten`               | Buku (bisa dilipat), tambah buku/topik/level, bank soal, aturan akses berbayar, pengecualian| Admin        |
| Bank Soal & Latihan | `/admin/soal`                 | Simulator kuis seperti anak dan kunci jawaban 10 soal per level dan seed               | Admin        |
| Galeri Aset         | `/admin/galeri`               | Semua gambar aplikasi per jenis, cari, detail, unduh SVG                               | Admin        |
| Audio Narasi        | `/admin/narasi`               | Pengaturan suara Momo, uji suara, semua teks yang dibacakan                            | Admin        |
| Ilustrasi AI        | `/admin/ilustrasi`            | Permintaan gambar dengan pratinjau, antrean tinjau (`/admin/asisten` dialihkan ke sini) | Admin        |
| Keluarga & Anak     | `/admin/keluarga`             | Ringkasan, tab Keluarga dan Anak, cari/saring/urutkan, Premium per anak, sandi gambar, nonaktifkan (`/admin/pengguna` dialihkan ke sini) | Admin        |
| Tim Staf & Akses    | `/admin/staf`                 | Daftar admin, tambah, atur kata sandi, nonaktifkan                                    | Admin        |
| Laporan & Rapor     | `/admin/laporan`              | Statistik level dan daftar anak                                                       | Admin        |
| Laporan anak (admin)| `/admin/laporan/anak/:id`     | Skor Jago, topik yang perlu ditemani, kemajuan tiap buku dan level                    | Admin        |
| Sertifikat Juara    | `/admin/sertifikat`           | Lembar yang berlaku (dengan QR) dan dialog Atur isi lembar, desain, daftar Menunggu, sertifikat terbit (nama di lembar, cek keaslian) | Admin        |
| Transaksi & Bukti   | `/admin/transaksi`            | Pesanan menurut status, bukti transfer, setujui atau tolak                            | Admin        |
| Paket Langganan     | `/admin/paket`                | Tambah, ubah, hapus paket: nama, keterangan, harga normal, harga jual, masa aktif     | Admin        |
| Rekening & Pembayaran | `/admin/rekening`           | Bank dan e-wallet tujuan transfer, petunjuk bayar                                     | Admin        |
| Pengaturan Sistem   | `/admin/pengaturan`           | Batas bayar pesanan, kontak WhatsApp, data contoh (mode tiruan)                        | Admin        |
| 404                 | `*`                           | Halaman tidak ditemukan dengan tombol kembali (nada ramah anak)                       | Tidak        |

Pengalihan: `/play/*` tanpa sesi anak ke `/play/masuk`. `/orang-tua/*` tanpa sesi orang tua ke `/orang-tua/masuk`.
`/admin/*` tanpa sesi admin ke `/masuk/staf`. Sesi dengan peran lain dialihkan ke beranda perannya.

## 8. Panduan Tampilan

- **Kesan:** hangat, jelas, dan tenang. Area anak besar dan bersahabat. Area orang tua dan admin lebih rapat, seperti alat
  kerja. Identitas visual ditulis sendiri untuk produk ini; warna hanya dipakai lewat token. Tema terang saja.
- **Tanpa framework UI.** CSS biasa dengan token sendiri: `apps/web/src/styles/uk-tokens.css` (token), `uk-components.css`
  dan `uk-adult.css` (area dewasa dan landing, kelas berawalan `uk-`), `play.css` dan `peta.css` (area anak),
  `certificate.css` (lembar sertifikat, cetak, halaman sertifikat, dan halaman cek keaslian), dan `admin/admin.css` (panel
  admin). Ikon berupa komponen SVG sendiri (tanpa emoji, tanpa pustaka ikon).
- **Token** (jangan menaruh hex baru di komponen). Nama memakai bahasa Indonesia:

  | Token                               | Nilai                 | Dipakai untuk                                                              |
  | ----------------------------------- | --------------------- | -------------------------------------------------------------------------- |
  | `--awan` / `--kertas`               | `#F6F7F8` / `#FFFFFF` | Latar halaman / kartu dan panel                                            |
  | `--malam` / `--malam-muted`         | `#1C2430` / `#5A6677` | Teks utama dan sekunder                                                    |
  | `--garis` / `--garis-tegas`         | `#DDE1E6` / `#7C8696` | Garis halus / batas tombol dan kartu yang bisa diketuk (kontras â‰¥ 3:1)     |
  | `--gonjong` (`-tekan`, `-soft`)     | `#C8321F`             | Warna merek: tombol utama, logo, sorotan. Bukan tanda kesalahan             |
  | `--kunyit` (`-tekan`, `-soft`, `-teks`) | `#F5B301`         | Poin, bintang, sertifikat, dan jawaban belum tepat (bingkai kuning + petunjuk) |
  | `--sawah` (`-tekan`, `-soft`)       | `#167A48`             | Jawaban tepat, level lulus, kemajuan                                       |
  | `--m` (data-mapel)                  | merah / hijau / biru  | Warna mapel aktif: Matematika `#C8321F`, Sains `#2B7A3D`, mapel lain `#1F6FC5` |
  | `--bahaya`                          | `#B3261E`             | **Hanya area orang tua dan admin** untuk tindakan hapus. Tidak pernah untuk jawaban anak |

  Tombol berbentuk anak tangga: bayangan padat 5 px di bawahnya (`--shadow-tekan`) yang hilang saat ditekan, tanpa garis
  hitam tebal. Radius 8, 16, dan 24 px.

  Warna Momo (6 pilihan, tanpa ungu dan tanpa merah): `blue #3B82C4`, `green #3FA66B`, `yellow #F2B705`,
  `orange #F08A24`, `pink #EC7FA8`, `teal #2AA5A0`.
- **Font:** Andika untuk isi (dirancang untuk pembaca pemula) dan Baloo 2 untuk judul, dipasang lokal lewat `@fontsource`.
  Area anak: isi 20 sampai 24 px, soal 28 sampai 32 px. Area dewasa: 14 sampai 16 px.
- **Komponen anak:** `BigButton`, `BigCard`, `Momo` (robot SVG buatan sendiri, 6 warna lewat CSS variable), `Plant` (4
  tahap SVG), `ListenButton`, `SpeakButton`, `AnswerOptions`, `Keypad`, `PicturePin` (grid 3 Ã— 3, 9 gambar SVG),
  `CountObjects`, `RoundProgress`, `Stopwatch`, `PetaBelajar`, `PremiumNotice`.
- **Komponen bersama:** `CertificateSheet` (lembar sertifikat SVG A4 mendatar dari satu daftar bentuk, termasuk kode QR
  buatan pustaka `uqr`; daftar yang sama digambar ke kanvas untuk unduhan PNG) dan `CertificatePrint` (salinan khusus
  cetak). Isi teks lembar selalu datang dari Pengaturan lewat `SheetData.settings`.
- **Komponen dewasa:** `AppShell` (sidebar yang bisa disembunyikan, laci di layar sempit, bilah atas untuk lonceng
  notifikasi admin), `Card`, `Table`, `FormField`, `TextArea`, `SelectField`, `Select` (dropdown bergaya), `Switch`, `Segmented`, `Stepper`, `Checkbox`, `Pager`
  (paging tabel), `Dialog`, `Badge`, `Notice`, `PlanBadge`, grafik dasbor.
- **Tata letak:**
  - **Anak:** bilah atas tipis di beranda: chip profil (Momo kecil, nama panggilan, poin bintang) dan dua tombol ikon
    (Peringkat, Selesai), masing-masing â‰¥ 64 px. Tidak ada navigasi bawah; halaman lain memakai kepala halaman dengan
    tombol kembali. Konten maksimal sekitar 1000 px, di tengah.
  - **Orang tua dan admin (desktop):** sidebar kiri, konten kanan. Di ponsel sidebar menjadi menu geser. Sidebar admin
    berlatar `--malam` agar jelas beda dari area orang tua.
- **Halaman ronde:** kepala dengan tombol berhenti, judul level, dan stopwatch; di bawahnya 10 titik indikator. Soal di
  tengah dengan tombol dengar (64 px) dan `CountObjects` bila ada. Pilihan jawaban berupa kartu besar (tinggi â‰¥ 96 px)
  yang langsung dinilai saat diketuk; isian angka memakai `Keypad` 0 sampai 9 dan tombol ceklis bulat. Panel umpan balik
  tetap di bawah layar: hijau ("Tepat! Kamu teliti menghitung.") atau kuning ("Belum tepat." + petunjuk + jawaban tepat),
  dibacakan langsung, dengan tombol "Lanjut" â‰¥ 64 px. Animasi menghormati `prefers-reduced-motion`.
- **Aturan UX anak (wajib, diperiksa dengan skill `/child-ux-review`):**
  - Target sentuh minimal 64 Ã— 64 px dan semuanya bisa dioperasikan dengan mouse saja.
  - Setiap halaman membacakan isinya saat tampil; tombol dan tautan menyebut namanya saat diketuk. Audio gagal: diam, teks
    tetap tampil.
  - Tidak ada kata "salah" atau "gagal". Pakai "Belum tepat" dengan petunjuk.
  - Jawaban keliru tidak berwarna merah. Benar hijau, belum tepat kuning.
  - Pujian menyebut usaha ("Kamu teliti menghitung!", "atas ketekunannya berlatih"), bukan kepintaran.
  - Tidak ada nyawa, streak, atau hitung mundur. Stopwatch tanpa batas boleh.
  - Tidak ada harga, iklan, tautan keluar, atau chat AI di area anak. Level dan sertifikat Premium menampilkan ajakan
    meminta orang tua beserta langkah untuk orang tua.
  - Kalimat untuk anak maksimal 15 kata.
  - Data anak hanya nama panggilan, warna Momo, dan hash sandi gambar. Tanpa foto, email, tanggal lahir, gender. Satu
    tambahan opsional: nama lengkap khusus sertifikat yang diisi orang tua dengan persetujuan (bagian 4.2); anak tidak
    pernah melihat isiannya.
- **Keadaan tiap halaman:** loading, kosong (pesan ramah + tindakan berikutnya), error (pesan jelas + tombol "Coba lagi").
- **Responsif dan aksesibilitas:** cek di lebar 1280 px dan 390 px. Fokus keyboard terlihat, kontras teks â‰¥ 4,5:1, gambar
  bermakna punya teks alternatif (lembar sertifikat punya label lengkap), tombol ikon punya `aria-label`.

## 9. Struktur Database (PostgreSQL, Drizzle ORM)

Sumber skema adalah `apps/api/src/db/schema.ts`; migrasi SQL di `apps/api/drizzle/` dibuat dengan Drizzle Kit.
Terdapat 28 tabel. Identitas akun memakai UUID; katalog memakai slug dan ID teks yang sama dengan frontend.
Semua waktu kejadian memakai `timestamptz`, tanggal laporan dan buku kas dihitung dalam WIB.

| Tabel | Fungsi |
| --- | --- |
| `staff_users` | Akun admin dan cadangan peran fasilitator |
| `parents` | Akun keluarga, persetujuan, email dan Premium keluarga |
| `classes` | Cadangan struktur kelas; fitur belum aktif |
| `children` | Profil minimal, hash sandi gambar, penguncian, nama sertifikat dengan persetujuan |
| `books` | Buku per mata pelajaran dan kelas |
| `topics` | Materi, tips, urutan dan kode topik |
| `levels` | Konfigurasi generator, bank soal, pengecualian akses |
| `rounds` | Seed, snapshot konfigurasi dan waktu sesi |
| `round_answers` | Satu jawaban per indeks soal dan ronde |
| `quiz_results` | Hasil agregat dan respons akhir ronde yang idempoten |
| `level_progress` | Skor terbaik dan kelulusan per anak dan level |
| `topic_mastery` | Skor Jago dan tahap tanaman yang tidak turun |
| `events` | Cadangan sinkronisasi; belum dipakai alur online |
| `certificates` | Sertifikat unik per anak dan buku |
| `premium_grants` | Pemberian Premium admin per anak |
| `billing_packages` | Paket langganan |
| `payment_methods` | Rekening dan e-wallet tujuan |
| `orders` | Snapshot harga, rekening, kode unik dan bukti bytea |
| `cash_entries` | Buku kas; satu pemasukan per pesanan |
| `referrals` | Ajakan keluarga dan pencatatan komisi |
| `commission_payouts` | Catatan pembayaran komisi |
| `app_settings` | Pengaturan dinamis per bagian |
| `stamps` | Riwayat stempel sertifikat |
| `illustrations` | Permintaan, hasil gambar dan status kurasi |
| `media_files` | Gambar unggahan admin berupa bytea |
| `voice_clips` | Cache suara berdasarkan hash |
| `email_verifications` | Hash kode sekali pakai dan pembatasan percobaan |
| `email_outbox` | Antrean pengiriman email dengan retry |

Relasi inti: orang tua memiliki anak; buku memiliki topik dan level; anak memiliki ronde, jawaban, hasil,
progres, penguasaan dan sertifikat. Penghapusan anak menghapus aktivitas terkait melalui cascade.
Email unik tanpa membedakan huruf besar kecil. PK `(round_id, idx)` mencegah jawaban ganda;
`quiz_results.round_id`, `(child_id, book_slug)` sertifikat dan `cash_entries.order_id` unik.

Premium efektif adalah masa aktif terpanjang dari `parents.premium_until` dan pemberian admin anak.
Nilai akhir kosong pada pemberian admin berarti selamanya. Pesanan menyimpan snapshot paket serta rekening;
perubahan katalog pembayaran tidak mengubah pesanan lama. Status kedaluwarsa dihitung saat dibaca.

Seed idempoten mengisi konten, pengaturan, paket/rekening dan admin pertama; suntingan admin serta data keluarga
tetap dipertahankan. Data contoh hanya tersedia dalam mode mock. PGlite persisten tersedia untuk pengembangan
lokal; produksi memakai PostgreSQL melalui `DATABASE_URL`.

## 10. Aturan Keamanan (Guard dan Peran)

- Guard global mewajibkan autentikasi kecuali rute berdekorator publik. Hak akses memakai peran dan status akun
  dari database dengan cache paling lama 10 detik; perubahan akun membersihkan cache terkait.
- JWT memuat identitas dan versi kata sandi. Masa sesi orang tua 7 hari; admin dan anak 12 jam.
  Rahasia wajib, minimal 32 karakter di produksi. Penggantian kata sandi membatalkan token dewasa lama.
- Kata sandi dan sandi gambar di-hash dengan scrypt bersalt acak, dibandingkan memakai `timingSafeEqual`.
  Email yang tidak terdaftar tetap menjalani pemeriksaan hash pengganti pada login.
- Lima PIN keliru mengunci profil 1, 5, 30, lalu 120 menit. Pembaruan dilakukan dalam transaksi dan sandi benar
  tetap ditolak selama terkunci. Rate limiter berjendela geser membatasi percobaan per email, IP, dan kode.
- Identitas anak pada endpoint belajar berasal dari token. Akses orang tua memeriksa kepemilikan di klausa WHERE;
  data keluarga lain dijawab 404. Rute admin menolak peran lain dengan 403.
- Server memeriksa Premium, urutan level dan nilai. Respons pembuka ronde tidak mengandung kunci jawaban.
- Nama lengkap anak hanya disimpan setelah persetujuan orang tua untuk sertifikat. Cek keaslian publik memakai
  nama tersamar; peringkat tidak memuat ID anak. Email, nomor telepon, foto dan rekaman suara anak tidak disimpan.
- Validasi input memakai Zod. JSON standar maksimal 100 KB, bank soal/lembar sertifikat maksimal 5 MB,
  gambar bukti/media maksimal 3 MB. Jenis JPEG/PNG/WebP diperiksa melalui magic bytes, unggahan SVG ditolak.
- Kunci SMTP, layanan gambar, TTS, JWT dan database hanya berada di `.env` server. Tidak masuk bundle web,
  log atau Git. Email dikirim lewat outbox; isi dihapus setelah terkirim. Kode verifikasi di database berupa hash.
- Proxy hanya dipercaya dari loopback. Header `nosniff`, pembatasan framing dan CSP dipasang pada respons.
  Shutdown menutup koneksi HTTP, worker dan pool database. Backup PostgreSQL menggunakan kredensial lingkungan,
  bukan argumen proses; pemulihan memerlukan konfirmasi operator.

## 11. Stack

| Lapisan  | Pilihan                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces: `packages/engine`, `apps/web`, `apps/api` (tanpa Turborepo), TypeScript strict             |
| Web      | React 18 + Vite 7 + React Router 6.30 + Zustand 5, CSS dengan token sendiri, i18n JSON, suara peramban dan `<audio>` |
| API      | NestJS 11 (Express), Drizzle ORM + `pg`, PostgreSQL, Zod 4, JWT + `scrypt`, RateLimiter berjendela geser              |
| Engine   | TypeScript murni + Zod 4: skema, penilaian, Skor Jago, peringkat, RNG ber-seed, generator soal, validasi soal, paket, sertifikat |
| Layanan  | Model gambar Google (Ilustrasi AI), Google Cloud TTS Chirp 3 HD (suara)                                      |
| Test     | Vitest (engine coverage â‰¥ 90%), Testing Library + jsdom, Supertest + `unplugin-swc`                          |

## 12. Rencana Build Bertahap

| Minggu | Milestone      | Isi                                                                                                   | Status  |
| ------ | -------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| 1      | M0             | Dokumen produk dan keputusan arsitektur (tanpa kode)                                                  | Selesai |
| 1      | M1 sampai M5   | Semua tampilan tiga peran dengan data tiruan di browser (mode mock), mengikuti kontrak                | Selesai |
| 1      | Tambahan M5    | Paket dan pembayaran manual, Kelas 1 sampai 4 dan Peta Belajar, area anak bersuara, 2 level gratis + 2 Premium, Sertifikat Juara Digital | Selesai |
| 1      | Tambahan M5j   | Gambar tiap soal bisa diubah admin di dialog Sesuaikan soal: ganti jenis benda hitung dan jumlahnya (satu sampai tiga kelompok) dengan pratinjau langsung, pilih gambar dari Galeri Aset atau Ilustrasi AI yang disetujui, unggah gambar sendiri (PNG, JPG, WebP, maks 3 MB, dikecilkan otomatis), atau lepas gambar; anak melihat gambar itu di soalnya | Selesai |
| 1      | Tambahan M5i   | Semua pertanyaan konfirmasi memakai pop-up Ya atau Tidak bergaya aplikasi, tidak ada lagi kotak bawaan peramban (hapus paket, rekening, ilustrasi, data contoh; setujui pembayaran; tutup atau ganti soal yang belum disimpan) | Selesai |
| 1      | Tambahan M5h   | Stempel sertifikat: pilih yang sudah ada (segel bawaan atau riwayat unggahan) atau unggah baru; heatmap Jam ramai 24 jam dengan popover angka; soal di semua level bisa disesuaikan admin (20 soal contoh dari generator menjadi bank soal); simbol matematika dibacakan sebagai kata; desain sertifikat bernama Kuning, Merah, Hijau | Selesai |
| 1      | Tambahan M5g   | Mapel dinamis di Tambah buku (mapel sendiri, otomatis masuk dropdown); lembar sertifikat dengan satu tanda tangan kanan bawah (kanvas tulis, unggah foto dengan latar transparan otomatis, goresan bawaan) dan stempel digital emas; gulir dan pengetikan di admin lebih ringan (render CSS di luar layar, latar dialog tanpa buram, kartu soal tidak digambar ulang saat soal lain diketik) | Selesai |
| 1      | Tambahan M5f   | Silabus Belajar bisa menambah buku, topik, dan level (bank soal tulisan admin), aturan level gratis pindah ke sana dari Pengaturan Sistem; dropdown bergaya menggantikan daftar bawaan peramban; tombol aksi tabel menempati kolom tetap | Selesai |
| 1      | Tambahan M5e   | Isi lembar sertifikat dipindah ke dialog di Sertifikat Juara (Pengaturan Sistem tinggal akses berbayar, WhatsApp, data contoh); chip saring berwarna status dengan jumlah, badge seragam, tombol aksi tabel ringkas | Selesai |
| 1      | Tambahan M5d   | Data contoh mode tiruan (puluhan keluarga, anak, staf, transaksi, ribuan ronde, sertifikat, ilustrasi) yang bisa dimuat ulang atau dihapus di Pengaturan Sistem; paging di semua daftar admin dan riwayat transaksi orang tua; tombol kembali Detail Topik ke Peta Belajar | Selesai |
| 1      | Tambahan M5c   | Navigasi admin baru (Konten & Kurikulum, Media & Audio, Pengguna & Akademik, Langganan & Pembayaran), Ringkasan baru, Bank Soal & Latihan (simulator kuis), Sertifikat Juara terhubung Pengaturan, Galeri Aset, Audio Narasi, Ilustrasi AI | Selesai |
| 1      | Tambahan M5b   | Menu Pengaturan admin (level gratis, WhatsApp, lembar sertifikat), nama sertifikat dengan persetujuan orang tua, kode QR dan cek keaslian, panel admin lengkap (Keluarga, Staf, Laporan, Paket dan Rekening yang bisa ditambah, notifikasi) | Selesai |
| 2      | M6             | API fondasi: NestJS, database, seed, guard                                                            | Selesai |
| 2      | M7             | Akun, masuk, area orang tua, paket dan pesanan                                                        | Selesai |
| 2      | M8             | Katalog dan ronde di server, sertifikat terbit otomatis                                               | Selesai |
| 2      | M9             | Peringkat dan admin (keluarga, staf, laporan, transaksi, paket, rekening, sertifikat, pengaturan)      | Selesai |
| 2      | M10            | Ilustrasi AI dan suara di server                                                                      | Selesai* |
| 2      | M11            | Uji, keamanan, deploy, dan skrip demo                                                                 | Lokal berjalan; deploy menunggu |

## 13. Asumsi

- Nama produk "UdaKids" dan maskot "Momo" ditulis sekali di `config/app.ts`, sehingga bisa diganti tanpa mengubah
  komponen. Momo digambar sendiri sebagai SVG sederhana (robot biru).
- **Database: PostgreSQL lewat `DATABASE_URL`.** Rencana awal memakai Postgres milik project Supabase hanya sebagai hosting
  (tanpa Supabase Auth, RLS, Edge Functions, atau SDK Supabase). Postgres lokal atau VPS cukup dengan mengganti
  `DATABASE_URL`. Status: konfigurasi deployment mengikuti lingkungan tujuan.
- Hosting: web sebagai file statis dan API Node di layanan yang menjalankan proses terus-menerus, atau satu VPS dengan Nginx
  + systemd. Status: konfigurasi deployment mengikuti lingkungan tujuan.
- Token JWT dikirim lewat header Bearer dan disimpan di `localStorage`, karena web dan API bisa berbeda domain.
- Klip suara dan bukti transfer disimpan sebagai `bytea` di PostgreSQL.
- Satu soal dinilai sekali. Setelah "Belum tepat", anak melihat petunjuk lalu lanjut. "Coba lagi" membuka ronde baru
  dengan seed baru.
- Tidak ada verifikasi email saat daftar dan lupa kata sandi di rilis 1.0. Kode konfirmasi ganti email di mode tiruan
  adalah `123456`.
- Pembayaran Premium: transfer manual ke rekening atas nama pemilik produk, bukti diperiksa admin. Nomor WhatsApp admin
  awalnya dari `content/billing.json` (server: `ADMIN_WHATSAPP`), lalu diatur admin di Pengaturan.
- Pengaturan, paket, dan rekening disimpan di database dan dibaca halaman saat dibuka; di mode tiruan disimpan di
  `localStorage` bersama data tiruan lain dan berlaku langsung. Isi awal paket dan rekening tetap dari `content/billing.json`.
- Rilis 1.0 hanya punya satu peran admin. Nama lengkap anak di sertifikat bersifat opsional dan hanya ada atas
  persetujuan orang tua; tanpa itu, sertifikat memakai nama panggilan.
- Sertifikat dibuat di browser dari data sertifikat (SVG untuk layar dan cetak, kanvas untuk PNG), sehingga server tidak
  perlu membuat berkas PDF atau gambar.
- Soal dibuat generator di `engine`, bukan disalin dari platform lain.
- Judul topik Matematika A tetap "Bilangan sampai 100" (Kurikulum Merdeka Kelas 1 SD).
- Nama model gambar diatur melalui `OPENAI_IMAGE_MODEL` pada backend karena provider dapat berubah. Mode tiruan menyusun ilustrasi dari
  pustaka bentuk sendiri (selalu sama untuk permintaan yang sama) agar alurnya bisa dicoba tanpa biaya.
- Mode tiruan memuat data contoh saat aplikasi pertama dibuka: 49 keluarga, sekitar 97 anak, 31 staf, sekitar 100
  transaksi dengan semua status, ribuan ronde, sertifikat terbit dan menunggu, ilustrasi, dan pemberian Premium. Semua
  id berawalan `demo-`, isinya selalu sama, dan tanggalnya dihitung mundur dari saat dimuat. Admin bisa memuat ulang
  atau menghapusnya di Pengaturan Sistem tanpa menyentuh data buatan sendiri. Seed database di M6 memakai isi yang sama.
- Waktu ditampilkan sesuai zona waktu perangkat (umumnya WIB).