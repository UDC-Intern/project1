import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { gte, inArray, sql } from 'drizzle-orm';
import { speakableText } from '@udakids/engine';
import { DB, type Db } from '../db/db.module.js';
import { voiceClips } from '../db/schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { jakartaDate } from '../common/dates.js';
export type TtsProvider = {
  synthesize(text: string, voice: string, rate: number): Promise<Buffer>;
};
export const TTS_PROVIDER = Symbol('TTS_PROVIDER');
export const clipHash = (text: string, voice: string, rate: number) =>
  createHash('sha256')
    .update(`chirp3-hd|${voice}|${rate}|${speakableText(text).replace(/\s+/g, ' ').trim()}`)
    .digest('hex');
export function ttsFromEnv(): TtsProvider | null {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) return null;
  return {
    async synthesize(text, voice, rate) {
      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'id-ID', name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error('Suara belum tersedia.');
      const data = (await response.json()) as { audioContent?: string };
      if (!data.audioContent) throw new Error('Klip kosong.');
      return Buffer.from(data.audioContent, 'base64');
    },
  };
}
@Injectable()
export class VoiceService implements OnModuleDestroy {
  private queue: { hash: string; text: string; voice: string; rate: number }[] = [];
  private queued = new Set<string>();
  private worker: Promise<void> | null = null;
  private stopped = false;
  constructor(
    @Inject(DB) private db: Db,
    private settings: SettingsService,
    @Inject(TTS_PROVIDER) private tts: TtsProvider | null,
  ) {}
  onModuleDestroy() {
    this.stopped = true;
    this.queue = [];
  }
  async urls(texts: string[]) {
    const settings = await this.settings.get();
    if (!settings.voice.enabled) return texts.map(() => null);
    const voice = process.env.TTS_VOICE ?? 'id-ID-Chirp3-HD-Leda';
    const rate = settings.voice.rate;
    const normalized = texts.map((t) => speakableText(t).replace(/\s+/g, ' ').trim());
    const hashes = normalized.map((t) => clipHash(t, voice, rate));
    const rows = hashes.length
      ? await this.db
          .select({ hash: voiceClips.hash })
          .from(voiceClips)
          .where(inArray(voiceClips.hash, hashes))
      : [];
    const found = new Set(rows.map((r) => r.hash));
    if (this.tts && !this.stopped) {
      hashes.forEach((hash, i) => {
        if (!found.has(hash) && !this.queued.has(hash) && this.queue.length < 200) {
          this.queue.push({ hash, text: normalized[i]!, voice, rate });
          this.queued.add(hash);
        }
      });
      this.startWorker();
    }
    return hashes.map((hash) => (found.has(hash) ? `/api/voice/${hash}` : null));
  }
  private startWorker() {
    if (this.worker || !this.queue.length) return;
    this.worker = this.run()
      .catch(() => {
        console.error('Antrean suara belum bisa diproses.');
      })
      .finally(() => {
        this.worker = null;
        if (this.queue.length && !this.stopped) this.startWorker();
      });
  }
  private async run() {
    while (this.queue.length && !this.stopped) {
      const item = this.queue.shift()!;
      try {
        const [count] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(voiceClips)
          .where(gte(voiceClips.createdAt, new Date(`${jakartaDate()}T00:00:00+07:00`)));
        if (count!.n >= Number(process.env.TTS_DAILY_LIMIT ?? 300)) {
          this.queue = [];
          this.queued.clear();
          return;
        }
        const exists = await this.db
          .select({ hash: voiceClips.hash })
          .from(voiceClips)
          .where(sql`${voiceClips.hash}=${item.hash}`);
        if (!exists.length && this.tts) {
          const data = await this.tts.synthesize(item.text, item.voice, item.rate);
          await this.db
            .insert(voiceClips)
            .values({ ...item, mime: 'audio/mpeg', bytes: data.length, data })
            .onConflictDoNothing();
        }
      } catch {
        /* Kegagalan suara tidak menghentikan ronde anak. */
      } finally {
        this.queued.delete(item.hash);
      }
    }
  }
  async drain() {
    while (this.worker) await this.worker;
  }
}
