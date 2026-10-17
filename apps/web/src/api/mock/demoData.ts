import {
  CERTIFICATE_DESIGNS,
  MOMO_COLORS,
  PIN_PICTURES,
  certificateNumber,
  createRng,
  extendPremium,
  formatRupiah,
  generateRound,
  initialMastery,
  meanScore,
  mulberry32,
  orderAmounts,
  orderNumber,
  scoreRound,
  seedFrom,
  uniqueCodeFor,
  updateMastery,
  type BillingPackage,
  type BookContent,
  type Certificate,
  type CertificateDesign,
  type GeneratedQuestion,
  type Illustration,
  type IllustrationRequest,
  type MasteryState,
  type MomoColor,
  type OrderStatus,
  type PaymentMethod,
  type Pin,
  type Rng,
} from '@udakids/engine';
import { certificateNameOf } from './certificate';
import {
  BOOKS,
  ILLUSTRATION_ENGINE,
  levelId,
  premiumUntilOf,
  readDb,
  syncChildPremium,
  topicId,
  writeDb,
  type MockChild,
  type MockDb,
  type MockOrder,
  type MockParent,
  type MockRound,
} from './db';
import { isLevelFree } from './settings';

/**
 * Data contoh mode tiruan: puluhan keluarga, anak, staf, transaksi, ronde, sertifikat, dan ilustrasi, supaya setiap
 * halaman (terutama panel admin) bisa dicoba dengan isi yang ramai. Semua id berawalan `demo-`, jadi data contoh bisa
 * dihapus atau dimuat ulang tanpa menyentuh data yang dibuat sendiri. Isinya selalu sama (RNG ber-seed); tanggalnya
 * dihitung mundur dari saat dimuat.
 */

/** Naikkan bila isi data contoh berubah: data contoh lama diganti saat aplikasi dibuka. */
export const DEMO_VERSION = 1;

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const WIB = 7 * HOUR;

export const isDemoId = (id: string) => id.startsWith('demo-');
const pad = (n: number, size = 2) => String(n).padStart(size, '0');
const iso = (ms: number) => new Date(ms).toISOString();

const PARENT_NAMES = [
  'Andi Pratama',
  'Siti Rahmawati',
  'Budi Santoso',
  'Dewi Lestari',
  'Eko Prasetyo',
  'Fitri Handayani',
  'Gilang Ramadhan',
  'Hana Wijaya',
  'Indra Gunawan',
  'Joko Susilo',
  'Kartika Sari',
  'Lukman Hakim',
  'Maya Anggraini',
  'Nur Aini',
  'Oki Setiawan',
  'Putri Maharani',
  'Rizal Fahmi',
  'Sri Wahyuni',
  'Teguh Santika',
  'Umi Kalsum',
  'Wahyu Hidayat',
  'Yuliana Putri',
  'Zainal Arifin',
  'Agustina Dewi',
  'Bambang Hermawan',
  'Citra Kirana',
  'Dedi Kurniawan',
  'Erna Susanti',
  'Fauzan Akbar',
  'Galuh Pertiwi',
  'Hendra Saputra',
  'Intan Permatasari',
  'Johan Siregar',
  'Kurniasih',
  'Lina Marlina',
  'Muhammad Iqbal',
  'Novita Sari',
  'Rahmat Hidayat',
  'Ratna Dewi',
  'Slamet Riyadi',
  'Tri Wulandari',
  'Wayan Sudarma',
  'Yohanes Tanjung',
  'Ayu Kusuma',
  'Benny Tambunan',
  'Dian Puspita',
  'Ferry Irawan',
  'Gusti Ngurah Putra',
];

const NICKNAMES = [
  'Aisyah',
  'Alif',
  'Amel',
  'Andin',
  'Arka',
  'Bagas',
  'Bella',
  'Bintang',
  'Caca',
  'Cinta',
  'Danu',
  'Dara',
  'Dika',
  'Dinda',
  'Elsa',
  'Fahri',
  'Farah',
  'Fikri',
  'Gita',
  'Hafiz',
  'Hana',
  'Ilham',
  'Intan',
  'Jihan',
  'Kevin',
  'Keysha',
  'Lala',
  'Luna',
  'Mira',
  'Naufal',
  'Nadia',
  'Naya',
  'Nisa',
  'Olivia',
  'Pandu',
  'Qila',
  'Raka',
  'Rani',
  'Reza',
  'Rizky',
  'Salsa',
  'Tari',
  'Tegar',
  'Tiara',
  'Umar',
  'Vina',
  'Wulan',
  'Yusuf',
  'Zahra',
  'Zaki',
  'Abel',
  'Alya',
  'Bayu',
  'Citra',
  'Davin',
  'Fira',
  'Galih',
  'Hilmi',
  'Kirana',
  'Lutfi',
  'Nabil',
  'Raisa',
  'Sekar',
  'Tama',
  'Yasmin',
  'Zidan',
  'Adit',
  'Kia',
  'Gibran',
  'Hasna',
  'Ivan',
  'Jasmine',
  'Kenzo',
  'Lukas',
  'Mutia',
  'Nayla',
  'Rafa',
  'Shinta',
  'Tasya',
  'Vino',
  'Wira',
  'Zoya',
  'Arsya',
  'Btari',
  'Cleo',
  'Dafa',
  'Embun',
  'Fathir',
  'Gendis',
  'Haikal',
];

const STAFF_NAMES = [
  'Nadia Paramitha',
  'Arif Budiman',
  'Laila Hasanah',
  'Yoga Pratama',
  'Melati Suryani',
  'Rendra Wijaksana',
  'Sinta Oktaviani',
  'Bayu Aji',
  'Fadhilah Rahma',
  'Gerry Halim',
  'Hesti Purwanti',
  'Irfan Maulana',
  'Juwita Sari',
  'Kevin Sanjaya',
  'Larasati Ningrum',
  'Malik Ibrahim',
  'Nurul Hidayah',
  'Oscar Siahaan',
  'Pratiwi Wulandari',
  'Qori Ananda',
  'Reza Mahendra',
  'Salsabila Putri',
  'Taufan Nugraha',
  'Ulfa Khairunnisa',
  'Vivian Tanoto',
  'Wisnu Adi',
  'Yasmin Azzahra',
  'Zulfikar Ali',
  'Astrid Maharani',
  'Bagus Setiadi',
  'Cahya Purnama',
];

/** Nama tengah untuk nama lengkap di sertifikat (netral, tanpa gelar). */
const MIDDLE_NAMES = ['Nur', 'Dwi', 'Tri', 'Aulia', 'Cahya', 'Surya', 'Kirana', 'Ananda'];

const GRANT_NOTES = [
  'Hadiah lomba mewarnai',
  'Program beasiswa sekolah mitra',
  'Kompensasi kendala pembayaran',
  'Uji coba untuk guru kelas',
  'Juara kuis bulanan',
  'Anak relawan komunitas baca',
  '',
];

const REJECT_NOTES = [
  'Nominal transfer belum sesuai dengan total pesanan.',
  'Bukti belum terbaca. Mohon kirim ulang foto yang lebih jelas.',
  'Transfer masuk ke rekening yang berbeda. Mohon cek kembali.',
  'Kode unik belum ikut ditransfer.',
];

/** Paket lama yang sudah tidak dijual (nonaktif): mengisi tabel Paket tanpa mengubah halaman depan. */
const PACKAGES: BillingPackage[] = [
  { id: 'demo-pkg-coba', name: 'Coba 7 Hari', durationDays: 7, listPrice: 15000, price: 5000 },
  {
    id: 'demo-pkg-ramadan',
    name: 'Promo Ramadan',
    durationDays: 30,
    listPrice: 50000,
    price: 12500,
  },
  {
    id: 'demo-pkg-merdeka',
    name: 'Promo Merdeka',
    durationDays: 90,
    listPrice: 150000,
    price: 30000,
  },
  {
    id: 'demo-pkg-liburan',
    name: 'Paket Liburan',
    durationDays: 60,
    listPrice: 100000,
    price: 25000,
  },
  {
    id: 'demo-pkg-juara',
    name: 'Hadiah Juara Kelas',
    durationDays: 30,
    listPrice: 50000,
    price: 10000,
  },
  {
    id: 'demo-pkg-kakak-adik',
    name: 'Kakak Adik',
    durationDays: 180,
    listPrice: 300000,
    price: 55000,
  },
  {
    id: 'demo-pkg-sekolah',
    name: 'Paket Sekolah Mitra',
    durationDays: 365,
    listPrice: 600000,
    price: 75000,
  },
].map((p, i) => ({
  ...p,
  description: 'Paket lama, sudah tidak dijual. Riwayat pesanannya tetap tersimpan.',
  active: false,
  sort: 20 + i,
}));

/** Rekening lama yang tidak dipakai lagi (nonaktif): tidak tampil di halaman bayar orang tua. */
const METHODS: PaymentMethod[] = [
  { id: 'demo-m-mandiri', kind: 'bank' as const, name: 'Mandiri', number: '1370012345678' },
  { id: 'demo-m-bri', kind: 'bank' as const, name: 'BRI', number: '002301000123567' },
  { id: 'demo-m-bsi', kind: 'bank' as const, name: 'BSI', number: '7123456789' },
  { id: 'demo-m-ovo', kind: 'ewallet' as const, name: 'OVO', number: '081200000001' },
  { id: 'demo-m-dana', kind: 'ewallet' as const, name: 'DANA', number: '081200000002' },
].map((m, i) => ({
  ...m,
  holder: 'Rekening contoh UdaKids',
  instructions: '',
  active: false,
  sort: 20 + i,
}));

const ILLUSTRATIONS: [IllustrationRequest['kind'], string, IllustrationRequest['theme']][] = [
  ['scene', 'apel merah di kebun', 'outdoor'],
  ['object', 'apel untuk berhitung', 'plain'],
  ['scene', 'bola di lapangan sekolah', 'outdoor'],
  ['object', 'bola warna-warni', 'plain'],
  ['scene', 'bintang di langit malam', 'outdoor'],
  ['object', 'bintang emas hadiah', 'plain'],
  ['scene', 'ikan di kolam', 'outdoor'],
  ['object', 'ikan hias', 'plain'],
  ['scene', 'daun gugur di taman', 'outdoor'],
  ['object', 'daun hijau segar', 'plain'],
  ['scene', 'buku di meja kelas', 'classroom'],
  ['object', 'buku cerita', 'plain'],
  ['scene', 'pohon di halaman', 'outdoor'],
  ['scene', 'tanaman di pot kelas', 'classroom'],
  ['character', 'Momo menyapa teman', 'plain'],
  ['character', 'Momo belajar berhitung', 'classroom'],
];

/** Keluarga contoh dengan kemajuan banyak, untuk mencoba area anak dan orang tua (kode keluarga CERDAS). */
const SHOWCASE = {
  name: 'Rina Kusumawati',
  familyCode: 'CERDAS',
  kids: [
    { nickname: 'Nara', momoColor: 'pink', pin: ['apple', 'star', 'fish'], grade: 1 },
    { nickname: 'Sakti', momoColor: 'teal', pin: ['ball', 'cloud', 'leaf'], grade: 3 },
    { nickname: 'Lili', momoColor: 'yellow', pin: ['cat', 'house', 'flower'], grade: 1 },
  ],
} as const;

type Ctx = {
  db: MockDb;
  rng: Rng;
  now: number;
  frac: () => number;
  /** Soal per level + seed. Ronde contoh memakai beberapa seed per level supaya cepat dibuat. */
  questions: Map<string, GeneratedQuestion[]>;
};

/** Banyak seed per level untuk ronde contoh (soal yang sama dikerjakan banyak anak, seperti di kelas). */
const SEEDS_PER_LEVEL = 4;
type Kid = { child: MockChild; index: number; grade: number; skill: number };
type Buyer = 'payer' | 'pending' | 'none' | 'showcase';
type Family = { parent: MockParent; kids: Kid[]; joinedAt: number; buyer: Buyer };

function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let r = rng.int(0, total - 1);
  for (const [value, w] of items) {
    if (r < w) return value;
    r -= w;
  }
  return items[items.length - 1]![0];
}

function emailOf(name: string, domain: string, used: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
  let email = `${base}@${domain}`;
  for (let n = 2; used.has(email); n++) email = `${base}${n}@${domain}`;
  used.add(email);
  return email;
}

// Huruf kode keluarga sama dengan pendaftaran: tanpa I dan O.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function familyCode(rng: Rng, used: Set<string>): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += LETTERS[rng.int(0, LETTERS.length - 1)];
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

// ---- Staf, paket, rekening ----

function addStaff({ db, rng, now }: Ctx): string[] {
  const used = new Set([...db.admins.map((a) => a.email), ...db.parents.map((p) => p.email)]);
  // Staf pertama selalu aktif: akunnya dipakai sebagai contoh masuk di README.
  const off = new Set(rng.shuffle(STAFF_NAMES.map((_, i) => i).slice(1)).slice(0, 6));
  const names: string[] = [];
  STAFF_NAMES.forEach((name, i) => {
    const active = !off.has(i);
    db.admins.push({
      id: `demo-a-${pad(i + 1)}`,
      name,
      email: emailOf(name, 'udakids.local', used),
      password: 'staf12345',
      active,
      createdAt: iso(now - rng.int(3, 240) * DAY - rng.int(0, 600) * MINUTE),
    });
    if (active) names.push(name);
  });
  return names;
}

function addCatalog({ db }: Ctx) {
  for (const p of PACKAGES) if (!db.packages.some((x) => x.id === p.id)) db.packages.push({ ...p });
  for (const m of METHODS) if (!db.methods.some((x) => x.id === m.id)) db.methods.push({ ...m });
}

// ---- Keluarga dan anak ----

function addFamilies(ctx: Ctx): Family[] {
  const { db, rng, now } = ctx;
  const usedEmails = new Set([...db.parents.map((p) => p.email), ...db.admins.map((a) => a.email)]);
  const usedCodes = new Set(db.parents.map((p) => p.familyCode));
  const nicknames = rng.shuffle(NICKNAMES);
  let nick = 0;
  let kidIndex = 0;

  const addKid = (
    family: Family,
    nickname: string,
    momoColor: MomoColor,
    pin: Pin,
    grade: number,
    createdAt: number,
  ): Kid => {
    const lastName = family.parent.name.split(' ').at(-1)!;
    const child: MockChild = {
      id: `demo-c-${pad(++kidIndex, 3)}`,
      parentId: family.parent.id,
      nickname,
      momoColor,
      pin,
      failedAttempts: 0,
      lockCount: 0,
      lockedUntil: null,
      createdAt: iso(createdAt),
    };
    if (rng.chance(0.35)) {
      child.certificateName = `${nickname} ${rng.pick(MIDDLE_NAMES)} ${lastName}`;
      child.certificateConsentAt = iso(Math.min(now - HOUR, createdAt + rng.int(1, 10) * DAY));
    }
    if (rng.chance(0.05)) child.active = false;
    db.children.push(child);
    const kid = { child, index: kidIndex, grade, skill: 0.6 + rng.int(0, 35) / 100 };
    family.kids.push(kid);
    return kid;
  };

  const families: Family[] = [];

  // Keluarga contoh: berlangganan bulanan hampir setahun.
  const showcaseJoined = now - 320 * DAY - 9 * HOUR;
  usedCodes.add(SHOWCASE.familyCode);
  const showcase: Family = {
    parent: {
      id: 'demo-p-00',
      name: SHOWCASE.name,
      email: emailOf(SHOWCASE.name, 'example.com', usedEmails),
      password: 'rahasia123',
      familyCode: SHOWCASE.familyCode,
      createdAt: iso(showcaseJoined),
      passwordChangedAt: null,
      pendingEmail: null,
      referredBy: null,
    },
    kids: [],
    joinedAt: showcaseJoined,
    buyer: 'showcase',
  };
  db.parents.push(showcase.parent);
  families.push(showcase);
  SHOWCASE.kids.forEach((k, i) => {
    const kid = addKid(
      showcase,
      k.nickname,
      k.momoColor,
      [...k.pin],
      k.grade,
      i < 2 ? showcaseJoined + (i + 1) * HOUR : now - 12 * DAY,
    );
    kid.skill = [0.9, 0.82, 0.74][i]!;
  });

  // Tanggal daftar: sebagian baru minggu ini (muncul di notifikasi), sisanya menyebar sampai 200 hari lalu.
  const joined = PARENT_NAMES.map(() => {
    const days = weighted(rng, [
      [rng.int(0, 6), 18],
      [rng.int(7, 60), 42],
      [rng.int(61, 200), 40],
    ]);
    return now - days * DAY - rng.int(30, 20 * 60) * MINUTE;
  }).sort((a, b) => a - b);

  PARENT_NAMES.forEach((name, i) => {
    const joinedAt = joined[i]!;
    const earlier = families.filter((f) => f.joinedAt < joinedAt && f.buyer !== 'showcase');
    const parent: MockParent = {
      id: `demo-p-${pad(i + 1)}`,
      name,
      email: emailOf(name, 'example.com', usedEmails),
      password: 'rahasia123',
      familyCode: familyCode(rng, usedCodes),
      createdAt: iso(joinedAt),
      passwordChangedAt: null,
      pendingEmail: null,
      referredBy: earlier.length && rng.chance(0.2) ? rng.pick(earlier).parent.familyCode : null,
    };
    if (rng.chance(0.06)) parent.active = false;
    db.parents.push(parent);
    const family: Family = {
      parent,
      kids: [],
      joinedAt,
      buyer: weighted<Buyer>(rng, [
        ['payer', 42],
        ['pending', 18],
        ['none', 40],
      ]),
    };
    families.push(family);

    // Sebagian kecil keluarga baru mendaftar dan belum membuat profil anak.
    const count = weighted(rng, [
      [0, 6],
      [1, 26],
      [2, 42],
      [3, 26],
    ]);
    if (count === 0) family.buyer = 'none';
    const pins: string[] = [];
    for (let k = 0; k < count; k++) {
      let nickname = nicknames[nick++ % nicknames.length]!;
      if (family.kids.some((x) => x.child.nickname === nickname))
        nickname = nicknames[nick++ % nicknames.length]!;
      let pin = rng.shuffle(PIN_PICTURES).slice(0, 3) as Pin;
      while (pins.includes(pin.join())) pin = rng.shuffle(PIN_PICTURES).slice(0, 3) as Pin;
      pins.push(pin.join());
      const createdAt = Math.min(now - 30 * MINUTE, joinedAt + rng.int(5, 3 * 24 * 60) * MINUTE);
      addKid(
        family,
        nickname,
        rng.pick(MOMO_COLORS),
        pin,
        weighted(rng, [
          [1, 40],
          [2, 25],
          [3, 20],
          [4, 15],
        ]),
        createdAt,
      );
    }
  });
  return families;
}

// ---- Transaksi dan Premium ----

/** Gambar bukti transfer contoh (SVG), supaya pratinjau bukti di halaman Transaksi terisi. */
function receipt(order: MockOrder, payer: string, at: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows: [string, string][] = [
    ['Ke', `${order.methodName} ${order.methodNumber}`],
    ['Atas nama', order.methodHolder],
    ['Dari', payer],
    [
      'Waktu',
      new Date(at).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      }),
    ],
    ['Berita', order.number],
  ];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="460" viewBox="0 0 360 460" font-family="Arial, sans-serif">' +
    '<rect width="360" height="460" fill="#eef1f6"/>' +
    '<rect x="18" y="18" width="324" height="424" rx="16" fill="#ffffff" stroke="#d7dce5"/>' +
    '<circle cx="180" cy="84" r="28" fill="#2f9e5f"/>' +
    '<path d="M167 84l9 9 18-18" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<text x="180" y="146" text-anchor="middle" font-size="18" font-weight="700" fill="#1d2a44">Transfer berhasil</text>' +
    `<text x="180" y="186" text-anchor="middle" font-size="28" font-weight="700" fill="#1d2a44">${esc(formatRupiah(order.total))}</text>` +
    rows
      .map(
        ([k, v], i) =>
          `<text x="40" y="${236 + i * 34}" font-size="13" fill="#6b7489">${k}</text>` +
          `<text x="320" y="${236 + i * 34}" text-anchor="end" font-size="13" font-weight="700" fill="#1d2a44">${esc(v)}</text>`,
      )
      .join('') +
    '<text x="180" y="420" text-anchor="middle" font-size="11" fill="#9aa2b3">Bukti contoh, mode tiruan</text>' +
    '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function addOrders(ctx: Ctx, families: Family[]) {
  const { db, rng, now } = ctx;
  const own = db.packages.filter((p) => !isDemoId(p.id));
  const promos = db.packages.filter((p) => isDemoId(p.id));
  const activeMethods = db.methods.filter((m) => !isDemoId(m.id) && m.active);
  const methods = activeMethods.length ? activeMethods : db.methods;
  // Paket dan rekening sendiri sudah dihapus semua: tidak ada yang bisa dipesan.
  if (own.length === 0 || methods.length === 0) return;
  const expiryMs = db.settings.billing.orderExpiryHours * HOUR;
  let n = 0;

  // Paket murah lebih sering dibeli; promo lama hanya pada pesanan yang sudah lama.
  const pickPackage = (createdAt: number): BillingPackage => {
    if (promos.length && now - createdAt > 60 * DAY && rng.chance(0.12)) return rng.pick(promos);
    return weighted(
      rng,
      own.map((p, i) => [p, [40, 25, 15, 12, 4][i] ?? 4] as const),
    );
  };

  const make = (
    family: Family,
    pkg: BillingPackage,
    createdAt: number,
    status: OrderStatus,
    proofAt: number | null = null,
  ): MockOrder => {
    const id = `demo-o-${pad(++n, 3)}`;
    const method = rng.pick(methods);
    const order: MockOrder = {
      id,
      number: orderNumber(createdAt, id),
      packageId: pkg.id,
      packageName: pkg.name,
      durationDays: pkg.durationDays,
      ...orderAmounts(pkg.listPrice, pkg.price, uniqueCodeFor(id)),
      methodId: method.id,
      methodName: method.name,
      methodNumber: method.number,
      methodHolder: method.holder,
      status,
      createdAt: iso(createdAt),
      expiresAt: iso(createdAt + expiryMs),
      proofName: null,
      proofAt: null,
      rejectNote: null,
      paidAt: null,
      parentId: family.parent.id,
      proofDataUrl: null,
    };
    if (proofAt !== null) {
      order.proofAt = iso(proofAt);
      order.proofName = `bukti-transfer-${pad(n, 3)}.jpg`;
      order.proofDataUrl = receipt(order, family.parent.name, proofAt);
    }
    db.orders[id] = order;
    return order;
  };

  // Pesanan yang belum lewat batas waktu tidak bisa kedaluwarsa: dibatalkan orang tua.
  const failed = (family: Family, createdAt: number) =>
    make(
      family,
      pickPackage(createdAt),
      createdAt,
      createdAt + expiryMs < now && rng.chance(0.6) ? 'expired' : 'cancelled',
    );

  /** Pembelian berulang: tiap paket diperpanjang menjelang habis. Pesanan yang terlalu baru menunggu verifikasi. */
  const buy = (family: Family, times: number, start: number, choose = pickPackage) => {
    let t = start;
    for (let i = 0; i < times && t < now - 2 * HOUR; i++) {
      const pkg = choose(t);
      const proofAt = t + rng.int(10, 180) * MINUTE;
      const paidAt = proofAt + rng.int(20, 600) * MINUTE;
      if (paidAt >= now - 10 * MINUTE) {
        make(family, pkg, t, 'awaiting_review', Math.min(proofAt, now - 5 * MINUTE));
        return null;
      }
      make(family, pkg, t, 'paid', proofAt).paidAt = iso(paidAt);
      if (pkg.durationDays === null) return null;
      t = paidAt + (pkg.durationDays - rng.int(0, 5)) * DAY + rng.int(0, 600) * MINUTE;
    }
    return t;
  };

  for (const family of families) {
    const start = family.joinedAt + rng.int(30, 3 * 24 * 60) * MINUTE;
    if (family.buyer === 'showcase') {
      // Langganan bulanan paket termurah: 11 kali lunas, satu pesanan pernah dibatalkan.
      const monthly = own.find((p) => p.durationDays === 30) ?? own[0]!;
      make(family, monthly, family.joinedAt + 2 * HOUR, 'cancelled');
      buy(family, 11, family.joinedAt + DAY, () => monthly);
    } else if (family.buyer === 'payer') {
      let t = start;
      if (rng.chance(0.3)) {
        failed(family, t);
        t += rng.int(1, 3) * DAY;
      }
      buy(family, rng.int(1, 4), t);
    } else if (family.buyer === 'pending') {
      if (rng.chance(0.5)) buy(family, rng.int(1, 2), start);
      const kind = weighted<OrderStatus>(rng, [
        ['awaiting_review', 50],
        ['awaiting_payment', 25],
        ['rejected', 25],
      ]);
      const floor = family.joinedAt + 10 * MINUTE;
      if (kind === 'awaiting_payment') {
        const hours = Math.max(1, db.settings.billing.orderExpiryHours - 2);
        const createdAt = Math.max(floor, now - rng.int(1, hours) * HOUR - rng.int(0, 50) * MINUTE);
        make(family, pickPackage(createdAt), createdAt, 'awaiting_payment');
      } else if (kind === 'awaiting_review') {
        const createdAt = Math.max(floor, now - rng.int(2, 72) * HOUR);
        const proofAt = Math.min(now - 2 * MINUTE, createdAt + rng.int(5, 90) * MINUTE);
        make(family, pickPackage(createdAt), createdAt, 'awaiting_review', proofAt);
      } else {
        const createdAt = Math.max(floor, now - rng.int(26, 140) * HOUR);
        const proofAt = Math.min(now - 2 * MINUTE, createdAt + rng.int(15, 120) * MINUTE);
        make(family, pickPackage(createdAt), createdAt, 'rejected', proofAt).rejectNote =
          rng.pick(REJECT_NOTES);
      }
    } else {
      const count = weighted(rng, [
        [0, 40],
        [1, 45],
        [2, 15],
      ]);
      for (let i = 0; i < count; i++) {
        const span = Math.max(HOUR, now - DAY - family.joinedAt);
        failed(family, family.joinedAt + rng.int(1, Math.floor(span / MINUTE)) * MINUTE);
      }
    }
  }

  // Antrean kerja admin cukup panjang untuk mencoba halaman Transaksi: perpanjangan paket yang dibayar lebih awal
  // (bukti sedang ditinjau) dan pesanan baru yang belum dibayar.
  const open = (status: OrderStatus) =>
    Object.values(db.orders).filter((o) => isDemoId(o.id) && o.status === status).length;
  for (const family of rng.shuffle(families.filter((f) => f.buyer === 'payer'))) {
    const createdAt = Math.max(family.joinedAt + HOUR, now - rng.int(1, 60) * HOUR);
    if (open('awaiting_review') < 12) {
      const proofAt = Math.min(now - 2 * MINUTE, createdAt + rng.int(5, 60) * MINUTE);
      make(family, pickPackage(createdAt), createdAt, 'awaiting_review', proofAt);
    } else if (open('awaiting_payment') < 5) {
      const hours = Math.max(1, db.settings.billing.orderExpiryHours - 2);
      const fresh = Math.max(family.joinedAt + HOUR, now - rng.int(1, hours) * HOUR);
      make(family, pickPackage(fresh), fresh, 'awaiting_payment');
    } else if (open('rejected') < 4) {
      const proofAt = Math.min(now - 2 * MINUTE, createdAt + rng.int(15, 120) * MINUTE);
      make(family, pickPackage(createdAt), createdAt, 'rejected', proofAt).rejectNote =
        rng.pick(REJECT_NOTES);
    } else break;
  }

  // Premium keluarga mengikuti pesanan lunas, sama seperti saat admin menyetujui pembayaran.
  for (const family of families) {
    const paid = Object.values(db.orders)
      .filter((o) => o.parentId === family.parent.id && o.status === 'paid' && o.paidAt)
      .sort((a, b) => a.paidAt!.localeCompare(b.paidAt!));
    let until: string | null = null;
    for (const o of paid) until = extendPremium(until, o.durationDays, Date.parse(o.paidAt!));
    if (until && Date.parse(until) > now) db.familyPremium[family.parent.id] = until;
  }
}

function addGrants(ctx: Ctx, families: Family[], staff: string[]) {
  const { db, rng, now } = ctx;
  const kids = rng.shuffle(families.filter((f) => f.buyer !== 'showcase').flatMap((f) => f.kids));
  const picks = [...kids.slice(0, 26), ...kids.slice(0, 3)];
  picks.forEach((kid, i) => {
    const born = Date.parse(kid.child.createdAt!);
    const createdAt =
      born + rng.int(0, Math.max(1, Math.floor((now - HOUR - born) / MINUTE))) * MINUTE;
    const days = weighted<number | null>(rng, [
      [30, 40],
      [90, 25],
      [180, 15],
      [365, 10],
      [null, 10],
    ]);
    // Pemberian kedua untuk anak yang sama: perpanjangan, bukan selamanya.
    const duration = i >= 26 && days === null ? 30 : days;
    db.premiumGrants.push({
      id: `demo-g-${pad(i + 1)}`,
      childId: kid.child.id,
      endsAt: duration === null ? null : iso(createdAt + duration * DAY),
      note: rng.pick(GRANT_NOTES),
      grantedBy: staff.length ? rng.pick(staff) : 'Admin UdaKids',
      createdAt: iso(createdAt),
    });
  });
  for (const kid of new Set(picks)) syncChildPremium(db, kid.child.id);
}

// ---- Belajar: ronde, level lulus, penguasaan, sertifikat ----

type LevelRef = {
  id: string;
  topicKey: string;
  number: number;
  generator: string;
  params: Record<string, unknown> | undefined;
};

const levelsOf = (book: BookContent, code?: string): LevelRef[] =>
  book.topics
    .filter((t) => !code || t.code === code)
    .flatMap((t) =>
      t.levels.map((l) => ({
        id: levelId(book.slug, t.code, l.number),
        topicKey: topicId(book.slug, t.code),
        number: l.number,
        generator: l.generator ?? '',
        params: l.generatorParams as Record<string, unknown> | undefined,
      })),
    );

type Attempt = {
  id: string;
  seed: number;
  level: LevelRef;
  answers: MockRound['answers'];
  correct: number;
  total: number;
  durationMs: number;
};

function wrongAnswer(rng: Rng, q: GeneratedQuestion): string {
  const others = (q.options ?? []).filter((o) => o !== q.answer);
  // Pengecoh pertama paling sering dipilih, supaya "jawaban keliru terbanyak" terlihat polanya.
  if (others.length) return rng.chance(0.6) ? others[0]! : rng.pick(others);
  const n = Number(q.answer);
  if (Number.isFinite(n)) {
    const v = n + rng.pick([1, -1, 2, 10, -10]);
    return String(v >= 0 ? v : n + 1);
  }
  return String(rng.int(1, 20));
}

function play(
  ctx: Ctx,
  kid: Kid,
  level: LevelRef,
  id: string,
  tries: number,
  sure: boolean,
): Attempt {
  const { rng, frac } = ctx;
  const seed = seedFrom(`${level.id}#${rng.int(1, SEEDS_PER_LEVEL)}`);
  const key = `${level.id}|${seed}`;
  let questions = ctx.questions.get(key);
  if (!questions) {
    questions = generateRound({ generator: level.generator, generatorParams: level.params }, seed);
    ctx.questions.set(key, questions);
  }
  const answers: MockRound['answers'] = {};
  let correct = 0;
  let durationMs = 0;
  questions.forEach((q, i) => {
    const p = Math.min(
      0.98,
      Math.max(0.3, kid.skill - 0.02 * (level.number - 1) - (i >= 7 ? 0.05 : 0) + 0.07 * tries),
    );
    const ok = sure || frac() < p;
    if (ok) correct += 1;
    answers[i] = { chosen: ok ? q.answer : wrongAnswer(rng, q), isCorrect: ok };
    durationMs += (q.type === 'number' ? rng.int(7, 16) : rng.int(4, 11)) * 1000 + rng.int(0, 999);
  });
  return { id, seed, level, answers, correct, total: questions.length, durationMs };
}

/** Waktu mulai tiap ronde: beberapa sesi belajar (kebanyakan sore, WIB), berurutan dan tidak bertumpuk. */
function schedule(ctx: Ctx, count: number, from: number, to: number): number[] {
  const { rng, frac } = ctx;
  const perSession = rng.int(2, 5);
  const sessions = Math.max(1, Math.ceil(count / perSession));
  const span = Math.max(HOUR, to - from);
  // Akar kuadrat: sesi lebih rapat menjelang akhir rentang, jadi aktivitas terbaru terlihat ramai.
  const starts = Array.from(
    { length: sessions },
    () => from + Math.floor(Math.sqrt(frac()) * span),
  ).sort((a, b) => a - b);
  const times: number[] = [];
  let cursor = 0;
  starts.forEach((s, i) => {
    const day = Math.floor((s + WIB) / DAY) * DAY - WIB;
    const hour = weighted(rng, [
      [7, 2],
      [9, 1],
      [13, 2],
      [15, 5],
      [16, 7],
      [17, 6],
      [18, 5],
      [19, 7],
      [20, 4],
    ]);
    let t = Math.max(day + hour * HOUR + rng.int(0, 59) * MINUTE, cursor + 20 * MINUTE);
    const size =
      i === sessions - 1 ? count - times.length : Math.min(perSession, count - times.length);
    for (let k = 0; k < size; k++) {
      times.push(t);
      t += rng.int(4, 7) * MINUTE;
    }
    cursor = t;
  });
  const overflow = (times.at(-1) ?? 0) - to;
  return overflow > 0 ? times.map((t) => t - overflow) : times;
}

type Goal = { finish: BookContent | null; budget: number; lagDays: number };

function learn(ctx: Ctx, kid: Kid, books: BookContent[], goal: Goal): Attempt[] {
  const { db } = ctx;
  const premium = premiumUntilOf(db, kid.child.id) !== null;
  const attempts: Attempt[] = [];
  let budget = goal.budget;
  const nextId = () => `demo-r-${pad(kid.index, 3)}-${pad(attempts.length + 1, 3)}`;

  /** Satu level sampai lulus. Tanpa `must`, anak menyerah setelah 3 kali dan pindah topik. */
  const pass = (level: LevelRef, must: boolean): boolean => {
    for (let tries = 0; ; tries++) {
      if (!must && attempts.length >= budget) return false;
      const a = play(ctx, kid, level, nextId(), tries, must && tries >= 3);
      attempts.push(a);
      if (scoreRound(a.correct, a.total - a.correct, a.total).passed) return true;
      if (!must && tries >= 2) return false;
    }
  };

  if (goal.finish) {
    for (const level of levelsOf(goal.finish)) pass(level, true);
    budget = attempts.length + goal.budget;
  }
  for (const book of books) {
    if (book === goal.finish) continue;
    for (const topic of book.topics) {
      for (const level of levelsOf(book, topic.code)) {
        if (attempts.length >= budget) return finishLearning(ctx, kid, attempts, goal);
        if (!premium && !isLevelFree(db, level.id, level.number)) break;
        if (!pass(level, false)) break;
      }
    }
  }
  return finishLearning(ctx, kid, attempts, goal);
}

/** Menyimpan ronde dengan waktunya, lalu level lulus, skor terbaik, penguasaan topik, dan level terakhir. */
function finishLearning(ctx: Ctx, kid: Kid, attempts: Attempt[], goal: Goal): Attempt[] {
  const { db, rng, now } = ctx;
  if (attempts.length === 0) return attempts;
  const id = kid.child.id;
  const born = Date.parse(kid.child.createdAt!);
  const to = now - goal.lagDays * DAY - rng.int(5, 600) * MINUTE;
  const from = Math.min(born + rng.int(1, 48) * HOUR, to - HOUR);
  const times = schedule(ctx, attempts.length, from, to);

  const mastery: Record<string, MasteryState> = (db.mastery[id] ??= {});
  const best = (db.best[id] ??= {});
  const passed = (db.passedLevels[id] ??= []);
  attempts.forEach((a, i) => {
    const startedAt = times[i]!;
    let state = mastery[a.level.topicKey] ?? initialMastery();
    const stageBefore = state.visibleStage;
    for (const answer of Object.values(a.answers)) state = updateMastery(state, answer.isCorrect);
    mastery[a.level.topicKey] = state;
    const wrong = a.total - a.correct;
    const { score, passed: ok } = scoreRound(a.correct, wrong, a.total);
    db.rounds[a.id] = {
      id: a.id,
      childId: id,
      levelId: a.level.id,
      seed: a.seed,
      startedAt,
      stageBefore,
      answers: a.answers,
      finishedAt: startedAt + a.durationMs,
      result: { score, correct: a.correct, wrong, durationMs: a.durationMs, passed: ok },
    };
    const prev = best[a.level.id];
    best[a.level.id] = {
      score: Math.max(prev?.score ?? 0, score),
      ms: Math.min(prev?.ms ?? Number.POSITIVE_INFINITY, a.durationMs),
    };
    if (ok && !passed.includes(a.level.id)) passed.push(a.level.id);
  });
  db.lastLevel[id] = attempts.at(-1)!.level.id;
  return attempts;
}

function issue(
  ctx: Ctx,
  kid: Kid,
  book: BookContent,
  source: Certificate['source'],
  at: number,
  draw: () => number,
): Certificate {
  const { db, now } = ctx;
  let id = certificateNumber(draw);
  while (db.certificates[id]) id = certificateNumber(draw);
  const ids = levelsOf(book).map((l) => l.id);
  const age = now - at;
  const design: CertificateDesign =
    age > 45 * DAY
      ? CERTIFICATE_DESIGNS[0]
      : age > 15 * DAY
        ? CERTIFICATE_DESIGNS[1]
        : db.certificateDesign;
  const cert: Certificate = {
    id,
    childId: kid.child.id,
    childName: certificateNameOf(db, kid.child),
    bookSlug: book.slug,
    bookTitle: book.title,
    topics: book.topics.length,
    levels: ids.length,
    design,
    issuedAt: iso(at),
    source,
    averageScore: meanScore(
      ids.flatMap((l) => {
        const b = db.best[kid.child.id]?.[l];
        return b ? [b.score] : [];
      }),
    ),
  };
  db.certificates[id] = cert;
  return cert;
}

function addLearning(ctx: Ctx, families: Family[], staff: string[]) {
  const { db, rng, now } = ctx;
  const bookOf = (slug: string) => BOOKS.find((b) => b.slug === slug);
  const mathOf = (grade: number) => bookOf(`matematika-kelas-${grade}`) ?? BOOKS[0]!;
  const science = bookOf('sains-kelas-1');
  const booksOf = (kid: Kid) => {
    const list = [mathOf(kid.grade)];
    if (kid.grade === 1 && science && rng.chance(0.6)) list.push(science);
    return list;
  };
  const draw = mulberry32(seedFrom(`sertifikat-contoh-${DEMO_VERSION}`));
  const isPremium = (kid: Kid) => premiumUntilOf(db, kid.child.id) !== null;
  const lastPassedAt = (kid: Kid, book: BookContent) =>
    Math.max(
      ...Object.values(db.rounds)
        .filter((r) => r.childId === kid.child.id && r.levelId.startsWith(`${book.slug}:`))
        .map((r) => r.finishedAt ?? 0),
    );

  // Keluarga contoh: Nara menuntaskan Matematika Kelas 1 (sertifikat terbit), Sakti di tengah jalan, Lili baru mulai.
  const showcase = families.find((f) => f.buyer === 'showcase');
  if (showcase) {
    const [nara, sakti, lili] = showcase.kids;
    if (nara) {
      const book = mathOf(1);
      learn(ctx, nara, science ? [science] : [], { finish: book, budget: 18, lagDays: 0 });
      issue(ctx, nara, book, 'auto', lastPassedAt(nara, book), draw);
    }
    if (sakti) learn(ctx, sakti, [mathOf(3)], { finish: null, budget: 34, lagDays: 1 });
    if (lili && science) learn(ctx, lili, [science], { finish: null, budget: 6, lagDays: 0 });
  }

  const others = families.filter((f) => f.buyer !== 'showcase').flatMap((f) => f.kids);
  const usable = (kid: Kid) =>
    kid.child.active !== false && now - Date.parse(kid.child.createdAt!) > 20 * DAY;
  const premiumKids = rng.shuffle(others.filter((k) => usable(k) && isPremium(k)));
  const freeKids = rng.shuffle(others.filter((k) => usable(k) && !isPremium(k)));
  const issued = new Set(premiumKids.slice(0, 20));
  const ready = new Set(premiumKids.slice(20, 24));
  const required = new Set(freeKids.slice(0, 5));

  for (const kid of others) {
    const books = booksOf(kid);
    const finisher = issued.has(kid) || ready.has(kid) || required.has(kid);
    if (finisher) {
      kid.skill = Math.max(kid.skill, 0.8);
      const book = books.length > 1 && rng.chance(0.35) ? books[1]! : books[0]!;
      // Sisakan minimal 10 hari untuk menuntaskan satu buku.
      const room = Math.floor((now - Date.parse(kid.child.createdAt!)) / DAY) - 10;
      const lagDays = Math.min(room, required.has(kid) ? rng.int(3, 20) : rng.int(0, 4));
      learn(ctx, kid, books, { finish: book, budget: rng.int(0, 8), lagDays });
      const doneAt = lastPassedAt(kid, book);
      if (issued.has(kid)) {
        const source = weighted<Certificate['source']>(rng, [
          ['auto', 70],
          ['claim', 15],
          ['admin', 15],
        ]);
        const at =
          source === 'auto' ? doneAt : Math.min(now - HOUR, doneAt + rng.int(1, 72) * HOUR);
        issue(ctx, kid, book, source, at, draw);
      }
      if (required.has(kid)) {
        // Premium dari admin sudah berakhir setelah buku tuntas: sertifikatnya menunggu Premium aktif lagi.
        const born = Date.parse(kid.child.createdAt!);
        db.premiumGrants.push({
          id: `demo-g-x${pad(kid.index, 3)}`,
          childId: kid.child.id,
          endsAt: iso(Math.min(now - HOUR, doneAt + DAY)),
          note: rng.pick(GRANT_NOTES),
          grantedBy: staff.length ? rng.pick(staff) : 'Admin UdaKids',
          createdAt: iso(born + HOUR),
        });
        syncChildPremium(db, kid.child.id);
      }
      continue;
    }
    const profile = weighted(rng, [
      ['idle', 10],
      ['light', 30],
      ['steady', 40],
      ['keen', 20],
    ] as const);
    if (profile === 'idle') continue;
    const inactive =
      kid.child.active === false ||
      db.parents.find((p) => p.id === kid.child.parentId)?.active === false;
    const budget =
      profile === 'light' ? rng.int(2, 8) : profile === 'steady' ? rng.int(9, 24) : rng.int(25, 45);
    const lagDays = inactive
      ? rng.int(20, 40)
      : profile === 'light'
        ? rng.int(3, 30)
        : profile === 'steady'
          ? rng.int(0, 2)
          : 0;
    const days = (now - Date.parse(kid.child.createdAt!)) / DAY - lagDays;
    if (days < 1) continue;
    learn(ctx, kid, books, {
      finish: null,
      budget: Math.min(budget, Math.floor(days * 6) + 2),
      lagDays,
    });
  }
}

// ---- Ilustrasi AI ----

function addIllustrations({ db, rng, now }: Ctx, staff: string[]) {
  for (let i = 0; i < 32; i++) {
    const [kind, subject, theme] = ILLUSTRATIONS[i % ILLUSTRATIONS.length]!;
    const status: Illustration['status'] = i < 18 ? 'approved' : i < 26 ? 'review' : 'rejected';
    const createdAt =
      status === 'review'
        ? now - rng.int(10, 4 * 24 * 60) * MINUTE
        : now - rng.int(3, 90) * DAY - rng.int(0, 600) * MINUTE;
    db.illustrations.push({
      id: `demo-il-${pad(i + 1)}`,
      kind,
      subject,
      theme,
      count: rng.int(3, 10),
      withMomo: kind === 'character' || rng.chance(0.5),
      momoColor: rng.pick(MOMO_COLORS),
      variant: 1 + Math.floor(i / ILLUSTRATIONS.length) * 4 + rng.int(0, 3),
      status,
      engine: ILLUSTRATION_ENGINE,
      createdBy: staff.length ? rng.pick(staff) : 'Admin UdaKids',
      createdAt: iso(createdAt),
      reviewedAt:
        status === 'review'
          ? null
          : iso(Math.min(now - MINUTE, createdAt + rng.int(30, 48 * 60) * MINUTE)),
    });
  }
}

// ---- Muat, hapus, ringkasan ----

/** Menambah semua data contoh ke `db` (tanpa menyimpan). Data contoh lama harus sudah dihapus. */
export function addDemoData(db: MockDb, now = Date.now()): void {
  const rng = createRng(seedFrom(`udakids-data-contoh-${DEMO_VERSION}`));
  const ctx: Ctx = {
    db,
    rng,
    now,
    frac: () => rng.int(0, 999_999) / 1_000_000,
    questions: new Map(),
  };
  const staff = addStaff(ctx);
  addCatalog(ctx);
  const families = addFamilies(ctx);
  addOrders(ctx, families);
  addGrants(ctx, families, staff);
  addLearning(ctx, families, staff);
  addIllustrations(ctx, staff);
  db.demo = { version: DEMO_VERSION, at: iso(now) };
}

/** Membuang semua data contoh beserta data yang menempel padanya (pesanan, ronde, sertifikat, Premium). */
export function removeDemoData(db: MockDb): void {
  const kids = new Set(
    db.children.filter((c) => isDemoId(c.id) || isDemoId(c.parentId)).map((c) => c.id),
  );
  db.parents = db.parents.filter((p) => !isDemoId(p.id));
  db.children = db.children.filter((c) => !kids.has(c.id));
  db.admins = db.admins.filter((a) => !isDemoId(a.id));
  db.packages = db.packages.filter((p) => !isDemoId(p.id));
  db.methods = db.methods.filter((m) => !isDemoId(m.id));
  db.illustrations = db.illustrations.filter((i) => !isDemoId(i.id));
  db.premiumGrants = db.premiumGrants.filter((g) => !isDemoId(g.id) && !kids.has(g.childId));
  for (const [id, o] of Object.entries(db.orders))
    if (isDemoId(id) || isDemoId(o.parentId)) delete db.orders[id];
  for (const id of Object.keys(db.familyPremium)) if (isDemoId(id)) delete db.familyPremium[id];
  for (const [id, r] of Object.entries(db.rounds))
    if (isDemoId(id) || kids.has(r.childId)) delete db.rounds[id];
  for (const [id, c] of Object.entries(db.certificates))
    if (kids.has(c.childId)) delete db.certificates[id];
  for (const map of [db.passedLevels, db.mastery, db.best, db.premiumUntil, db.lastLevel])
    for (const id of kids) delete map[id];
}

/** Jumlah baris data contoh yang sedang dimuat. */
export function demoSummary(db: MockDb = readDb()) {
  const kids = new Set(db.children.filter((c) => isDemoId(c.id)).map((c) => c.id));
  const counts = {
    families: db.parents.filter((p) => isDemoId(p.id)).length,
    children: kids.size,
    staff: db.admins.filter((a) => isDemoId(a.id)).length,
    orders: Object.keys(db.orders).filter(isDemoId).length,
    rounds: Object.keys(db.rounds).filter(isDemoId).length,
    certificates: Object.values(db.certificates).filter((c) => kids.has(c.childId)).length,
    illustrations: db.illustrations.filter((i) => isDemoId(i.id)).length,
    grants: db.premiumGrants.filter((g) => isDemoId(g.id)).length,
  };
  return { loaded: counts.families > 0, at: db.demo?.at ?? null, counts };
}
export type DemoSummary = ReturnType<typeof demoSummary>;

/**
 * Dipanggil saat aplikasi dibuka di mode tiruan: data contoh dimuat bila belum ada atau versinya lama. Bila admin
 * sudah menghapusnya, tidak dimuat lagi sampai dimuat ulang dari Pengaturan Sistem.
 */
export function ensureDemoData(now = Date.now()): void {
  const db = readDb();
  if (db.demo && db.demo.version >= DEMO_VERSION) return;
  removeDemoData(db);
  addDemoData(db, now);
  writeDb(db);
}

/** `POST /admin/demo-data`: data contoh lama dibuang, yang baru bertanggal mundur dari sekarang. */
export function reloadDemoData(now = Date.now()): DemoSummary {
  const db = readDb();
  removeDemoData(db);
  addDemoData(db, now);
  writeDb(db);
  return demoSummary(db);
}

/** `DELETE /admin/demo-data`: hanya data contoh yang dibuang; data buatan sendiri tetap. */
export function clearDemoData(): DemoSummary {
  const db = readDb();
  removeDemoData(db);
  db.demo = { version: DEMO_VERSION, at: null };
  writeDb(db);
  return demoSummary(db);
}
