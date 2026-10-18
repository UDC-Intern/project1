import { randomBytes, randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const profiles = [
  { nickname: 'Ayu', momoColor: 'blue', correct: 10 },
  { nickname: 'Bima', momoColor: 'green', correct: 9 },
  { nickname: 'Caca', momoColor: 'pink', correct: 8 },
  { nickname: 'Danu', momoColor: 'orange', correct: 7 },
  { nickname: 'Eka', momoColor: 'teal', correct: 6 },
];
const pictures = ['apple', 'ball', 'star', 'fish', 'leaf', 'flower', 'cat', 'house', 'cloud'];

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${path}: HTTP ${response.status} ${result?.error?.message ?? ''}`);
  }
  return result;
}

function pin() {
  return Array.from({ length: 3 }, () => pictures[randomInt(pictures.length)]);
}

async function save(access) {
  await writeFile(accessPath, `${JSON.stringify(access, null, 2)}\n`, { mode: 0o600 });
}

async function loadAccess() {
  await mkdir(dataDir, { recursive: true });
  try {
    const access = JSON.parse(await readFile(accessPath, 'utf8'));
    for (const parent of access.parents) {
      for (const child of parent.children) {
        if (child.pin.some((picture) => !pictures.includes(picture))) {
          if (child.id)
            throw new Error(`Sandi gambar ${child.nickname} di file demo tidak dikenal.`);
          child.pin = pin();
        }
      }
    }
    await save(access);
    return access;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const access = {
      parents: [0, 1].map((index) => ({
        name: `Orang Tua Demo ${index + 1}`,
        email: `demo.keluarga${index + 1}@example.test`,
        password: randomBytes(18).toString('base64url'),
        children: profiles.slice(index === 0 ? 0 : 3, index === 0 ? 3 : 5).map((child) => ({
          ...child,
          pin: pin(),
        })),
      })),
    };
    await save(access);
    return access;
  }
}

function answerFor(question) {
  const count = question.visual?.count;
  if (!Number.isInteger(count)) {
    throw new Error('Level demo sudah berubah; soal membilang tidak lagi memakai gambar benda.');
  }
  if (question.type === 'true_false') {
    const claimed = Number(question.prompt.match(/Di gambar ada (\d+)/)?.[1]);
    if (!Number.isInteger(claimed)) throw new Error('Format soal benar/salah sudah berubah.');
    const answer = claimed === count ? 'Benar' : 'Belum tepat';
    return { right: answer, wrong: answer === 'Benar' ? 'Belum tepat' : 'Benar' };
  }
  const right = String(count);
  const wrong =
    question.type === 'choice'
      ? question.options?.find((option) => option !== right)
      : String(count + 1);
  if (!wrong) throw new Error('Pilihan jawaban soal demo tidak lengkap.');
  return { right, wrong };
}

const health = await api('/health');
if (health.db !== true) throw new Error('Backend belum terhubung ke database.');
const access = await loadAccess();
const before = (await api('/leaderboard/top?mode=average')).entries.length;
let created = 0;

for (const parent of access.parents) {
  let session;
  try {
    session = await api('/auth/parent/login', {
      method: 'POST',
      body: { email: parent.email, password: parent.password },
    });
  } catch (error) {
    if (!String(error).includes('HTTP 401')) throw error;
    session = await api('/auth/parent/register', {
      method: 'POST',
      body: { name: parent.name, email: parent.email, password: parent.password, consent: true },
    });
  }
  if (!session.token)
    throw new Error('Akun demo memerlukan verifikasi email; matikan dulu untuk demo lokal.');
  parent.familyCode = session.user.familyCode;
  await save(access);
  const existing = await api('/parent/children', { token: session.token });

  for (const child of parent.children) {
    const row =
      existing.find((item) => item.nickname === child.nickname) ??
      (await api('/parent/children', {
        method: 'POST',
        token: session.token,
        body: { nickname: child.nickname, momoColor: child.momoColor, pin: child.pin },
      }));
    child.id = row.id;
    await save(access);
    const childSession = await api('/auth/child/login', {
      method: 'POST',
      body: { childId: child.id, pin: child.pin },
    });
    const board = await api('/leaderboard?mode=average', { token: childSession.token });
    if (board.me?.rounds) continue;

    const round = await api('/practice/rounds', {
      method: 'POST',
      token: childSession.token,
      body: { levelId: 'matematika-kelas-1:A:1' },
    });
    if (round.questions.length !== 10) throw new Error('Ronde demo harus berisi sepuluh soal.');
    for (const question of round.questions) {
      const options = answerFor(question);
      const shouldBeCorrect = question.index < child.correct;
      const result = await api(`/practice/rounds/${round.roundId}/answers`, {
        method: 'POST',
        token: childSession.token,
        body: {
          questionIndex: question.index,
          answer: shouldBeCorrect ? options.right : options.wrong,
        },
      });
      if (result.isCorrect !== shouldBeCorrect) {
        throw new Error(
          `Jawaban server untuk ${child.nickname} tidak sesuai pada soal ${question.index + 1}.`,
        );
      }
    }
    const result = await api(`/practice/rounds/${round.roundId}/finish`, {
      method: 'POST',
      token: childSession.token,
    });
    if (result.correct !== child.correct)
      throw new Error(`Hasil ronde ${child.nickname} tidak sesuai.`);
    created++;
  }
}

const after = await api('/leaderboard/top?mode=average');
for (const profile of profiles) {
  if (!after.entries.some((entry) => entry.nickname === profile.nickname)) {
    throw new Error(`${profile.nickname} belum muncul di papan peringkat backend.`);
  }
}
console.log(
  `Data demo terhubung: ${created} ronde baru; papan peringkat ${before} → ${after.entries.length} anak.`,
);
console.log(`Akses akun demo tersimpan hanya di ${accessPath}`);
