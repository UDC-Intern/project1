import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = join(root, '.data');
const accessPath = join(dataDir, 'demo-access.json');
const env = Object.fromEntries(
  (await readFile(join(root, '.env'), 'utf8'))
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_][A-Z_0-9]*=/.test(line))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
if (env.DATABASE_DRIVER !== 'pglite' || process.env.NODE_ENV === 'production') {
  throw new Error('Data demo hanya boleh dibuat pada PGlite lokal, bukan PostgreSQL produksi.');
}
const base = `http://127.0.0.1:${Number(env.API_PORT || 7177)}`;
const names = [
  'Ayu',
  'Bima',
  'Caca',
  'Danu',
  'Eka',
  'Aisyah',
  'Alif',
  'Amel',
  'Andin',
  'Arka',
  'Bagas',
  'Bella',
  'Bintang',
  'Cinta',
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
  'Hasna',
];
const colors = ['blue', 'green', 'pink', 'orange', 'teal', 'yellow'];
const demoPin = ['apple', 'apple', 'apple'];
const parentPassword = '12345678';
const adminPassword = 'admin123';

async function api(path, { method = 'GET', token, body } = {}) {
  let response;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      break;
    } catch (error) {
      if (!['ECONNRESET', 'ECONNREFUSED'].includes(error.cause?.code) || attempt === 5) throw error;
      await setTimeout((attempt + 1) * 500);
    }
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${path}: HTTP ${response.status} ${result?.error?.message ?? ''}`);
  }
  return result;
}

const save = (access) =>
  writeFile(accessPath, `${JSON.stringify(access, null, 2)}\n`, { mode: 0o600 });

async function loadAccess() {
  await mkdir(dataDir, { recursive: true });
  let access;
  try {
    access = JSON.parse(await readFile(accessPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    access = { parents: [] };
  }
  for (let family = 0; family < 24; family++) {
    access.parents[family] ??= {
      name: `Orang Tua Demo ${String(family + 1).padStart(2, '0')}`,
      email: `demo.keluarga${family + 1}@example.test`,
      password: parentPassword,
      children: [],
    };
    for (let slot = 0; slot < (family === 0 ? 5 : 3); slot++) {
      const index = family * 3 + slot;
      access.parents[family].children[slot] ??= {
        nickname: family === 0 && slot >= 3 ? ['Nina', 'Rafi'][slot - 3] : names[index],
        momoColor: colors[index % colors.length],
        correct: 10 - (index % 5),
        pin: demoPin,
      };
    }
  }
  access.staff ??= Array.from({ length: 5 }, (_, index) => ({
    name: `Admin Demo ${index + 1}`,
    email: `demo.admin${index + 1}@example.test`,
    password: adminPassword,
  }));
  return access;
}

const health = await api('/health');
if (health.db !== true) throw new Error('Backend belum terhubung ke database.');
const access = await loadAccess();
const admin = await api('/auth/staff/login', {
  method: 'POST',
  body: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
});
const result = await api('/admin/demo-data', {
  method: 'POST',
  token: admin.token,
  body: {
    parents: access.parents.map((family) => ({
      ...family,
      password: parentPassword,
      children: family.children.map((child) => ({ ...child, pin: demoPin })),
    })),
    staff: access.staff.map((person) => ({ ...person, password: adminPassword })),
  },
});
for (const family of access.parents) {
  family.password = parentPassword;
  for (const child of family.children) child.pin = demoPin;
}
for (const person of access.staff) person.password = adminPassword;
for (const family of result.familyAccess) {
  const saved = access.parents.find((parent) => parent.email === family.email);
  saved.familyCode = family.familyCode;
  for (const child of family.children) {
    saved.children.find((profile) => profile.nickname === child.nickname).id = child.id;
  }
}
await save(access);
if (
  result.families < 24 ||
  result.children < 70 ||
  result.admins < 5 ||
  result.rounds < 70 ||
  result.orders < 24 ||
  result.certificates < 3 ||
  result.illustrations < 12
) {
  throw new Error(
    `Jumlah data demo belum memenuhi target: ${JSON.stringify({
      families: result.families,
      children: result.children,
      admins: result.admins,
      rounds: result.rounds,
      orders: result.orders,
      certificates: result.certificates,
      illustrations: result.illustrations,
    })}`,
  );
}
const board = await api('/leaderboard/top?mode=average');
if (board.entries.length !== 10) throw new Error('Papan 10 besar belum terisi lengkap.');
console.log(
  `Data demo siap: ${result.families} keluarga, ${result.children} anak, ${result.admins} admin, ${result.rounds} ronde, ${result.orders} transaksi, ${result.certificates} sertifikat, ${result.illustrations} ilustrasi.`,
);
console.log(`Ronde baru pada eksekusi ini: ${result.newRounds}. Akses akun hanya di ${accessPath}`);
