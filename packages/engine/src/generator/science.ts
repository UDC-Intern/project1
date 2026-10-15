import { fourOptions, TRUE_FALSE_OPTIONS, type Family } from './types.js';

// Tabel fakta kecil: setiap baris sudah diperiksa benar untuk anak 6 sampai 7 tahun.
const BODY: { part: string; verb: string }[] = [
  { part: 'mata', verb: 'melihat' },
  { part: 'telinga', verb: 'mendengar' },
  { part: 'hidung', verb: 'mencium bau' },
  { part: 'lidah', verb: 'merasakan makanan' },
  { part: 'tangan', verb: 'memegang benda' },
  { part: 'kaki', verb: 'berjalan' },
  { part: 'gigi', verb: 'mengunyah makanan' },
  { part: 'kulit', verb: 'meraba benda' },
];

const SENSES: { sense: string; part: string; verb: string }[] = [
  { sense: 'Indra penglihatan', part: 'mata', verb: 'melihat' },
  { sense: 'Indra pendengaran', part: 'telinga', verb: 'mendengar' },
  { sense: 'Indra penciuman', part: 'hidung', verb: 'mencium bau' },
  { sense: 'Indra pengecap', part: 'lidah', verb: 'mengecap rasa' },
  { sense: 'Indra peraba', part: 'kulit', verb: 'meraba' },
];

const CARE: { prompt: string; answer: string; wrong: string[]; explanation: string }[] = [
  {
    prompt: 'Kapan kita menyikat gigi?',
    answer: 'Pagi dan malam',
    wrong: ['Hanya saat sakit', 'Setahun sekali', 'Tidak perlu'],
    explanation: 'Menyikat gigi pagi dan malam menjaga gigi tetap sehat.',
  },
  {
    prompt: 'Apa yang kita lakukan sebelum makan?',
    answer: 'Mencuci tangan',
    wrong: ['Berlari', 'Melompat', 'Tidur'],
    explanation: 'Tangan yang bersih menjaga kita dari kuman.',
  },
  {
    prompt: 'Apa yang membuat tubuh kuat?',
    answer: 'Makan makanan sehat',
    wrong: ['Makan permen saja', 'Tidak makan', 'Minum es banyak'],
    explanation: 'Makanan sehat membuat tubuh kuat dan tumbuh.',
  },
  {
    prompt: 'Apa yang kita lakukan agar tubuh bersih?',
    answer: 'Mandi',
    wrong: ['Bermain tanah', 'Tidak mandi', 'Makan'],
    explanation: 'Mandi membuat tubuh bersih dan segar.',
  },
  {
    prompt: 'Berapa lama anak kecil perlu tidur malam?',
    answer: 'Cukup lama',
    wrong: ['Hanya sebentar', 'Tidak perlu tidur', 'Sepanjang hari'],
    explanation: 'Tidur cukup membuat tubuh segar dan tumbuh.',
  },
  {
    prompt: 'Apa yang baik untuk gigi?',
    answer: 'Sayur dan buah',
    wrong: ['Permen terus-menerus', 'Es krim terus-menerus', 'Minuman manis'],
    explanation: 'Sayur dan buah baik untuk gigi dan tubuh.',
  },
  {
    prompt: 'Apa yang kita minum agar tubuh sehat?',
    answer: 'Air putih',
    wrong: ['Minuman manis saja', 'Kopi', 'Tidak minum'],
    explanation: 'Air putih menjaga tubuh tetap sehat.',
  },
  {
    prompt: 'Apa yang kita lakukan agar tubuh bergerak sehat?',
    answer: 'Berolahraga',
    wrong: ['Duduk terus', 'Tiduran terus', 'Menonton terus'],
    explanation: 'Bergerak dan berolahraga membuat tubuh kuat.',
  },
];

const PARTS = BODY.map((b) => b.part);
const VERBS = BODY.map((b) => b.verb);

/** Bagian tubuh dan gunanya. */
export const bodyParts: Family = (rng, band) => {
  const fact = rng.pick(BODY);
  if (band === 2 && rng.chance(0.5)) {
    const wrong = rng.pick(BODY.filter((b) => b.part !== fact.part));
    const truthy = rng.chance(0.5);
    const part = truthy ? fact.part : wrong.part;
    return {
      type: 'true_false',
      prompt: `Kita ${fact.verb} dengan ${part}.`,
      visual: null,
      options: TRUE_FALSE_OPTIONS,
      answer: truthy ? 'Benar' : 'Belum tepat',
      explanation: `Kita ${fact.verb} dengan ${fact.part}.`,
    };
  }
  return {
    type: 'choice',
    prompt: `Kita ${fact.verb} dengan apa?`,
    visual: null,
    options: fourOptions(rng, fact.part, PARTS),
    answer: fact.part,
    explanation: `Kita ${fact.verb} dengan ${fact.part}.`,
  };
};

/** Panca indra dan fungsinya. */
export const senses: Family = (rng, band) => {
  const fact = rng.pick(SENSES);
  if (band === 2 && rng.chance(0.5)) {
    const wrong = rng.pick(SENSES.filter((s) => s.part !== fact.part));
    const truthy = rng.chance(0.5);
    return {
      type: 'true_false',
      prompt: `${fact.sense} memakai ${truthy ? fact.part : wrong.part}.`,
      visual: null,
      options: TRUE_FALSE_OPTIONS,
      answer: truthy ? 'Benar' : 'Belum tepat',
      explanation: `${fact.sense} memakai ${fact.part}.`,
    };
  }
  if (band === 0) {
    return {
      type: 'choice',
      prompt: `${fact.sense} memakai bagian tubuh apa?`,
      visual: null,
      options: fourOptions(rng, fact.part, SENSES.map((s) => s.part).concat(['tangan', 'kaki'])),
      answer: fact.part,
      explanation: `${fact.sense} memakai ${fact.part}.`,
    };
  }
  return {
    type: 'choice',
    prompt: `${fact.part[0]!.toUpperCase()}${fact.part.slice(1)} dipakai untuk apa?`,
    visual: null,
    options: fourOptions(rng, fact.verb, SENSES.map((s) => s.verb).concat(VERBS)),
    answer: fact.verb,
    explanation: `${fact.part[0]!.toUpperCase()}${fact.part.slice(1)} dipakai untuk ${fact.verb}.`,
  };
};

/** Merawat tubuh dan gigi. */
export const bodyCare: Family = (rng, band) => {
  const item = rng.pick(CARE);
  if (band === 2 && rng.chance(0.4)) {
    const truthy = rng.chance(0.5);
    const choice = truthy ? item.answer : rng.pick(item.wrong);
    return {
      type: 'true_false',
      prompt: `${item.prompt} ${choice}.`,
      visual: null,
      options: TRUE_FALSE_OPTIONS,
      answer: truthy ? 'Benar' : 'Belum tepat',
      explanation: item.explanation,
    };
  }
  return {
    type: 'choice',
    prompt: item.prompt,
    visual: null,
    options: fourOptions(rng, item.answer, item.wrong),
    answer: item.answer,
    explanation: item.explanation,
  };
};

export const scienceFamilies: Record<string, Family> = {
  'body-parts': bodyParts,
  senses,
  'body-care': bodyCare,
};
