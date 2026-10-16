import { voiceSettingsSchema, type AppSettings, type VoiceSettings } from '@udakids/engine';
import { useEffect, useState, type FormEvent } from 'react';
import type { CatalogBook } from '../../api/adminTypes';
import { settingsChanged } from '../../api/settings';
import { indonesianVoices, speak, stopSpeaking } from '../../audio/speech';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t, translate } from '../../i18n';
import { ShellIconSvg } from '../../ui/AppShell';
import { CountUp, Kpi } from '../../ui/charts';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Notice,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
} from '../../ui/ui';
import { ActionNotice, Loadable, useAction } from '../common';

/** Kalimat tetap yang dibacakan Momo di ronde (dari teks area anak). */
const FIXED_LINES = ['feedback.correct', 'feedback.retry'] as const;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** Perkiraan lama baca: sekitar 2,4 kata per detik pada kecepatan 1. */
const seconds = (text: string, rate: number) => Math.max(1, Math.round(words(text) / (2.4 * rate)));
const duration = (s: number) =>
  s < 60
    ? t('admin.voice.sec', { n: s })
    : t('admin.voice.min', { m: Math.floor(s / 60), s: s % 60 });

function useVoices() {
  const [voices, setVoices] = useState(indonesianVoices);
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    const update = () => setVoices(indonesianVoices());
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, []);
  return voices;
}

function PlayButton({ text, voice, label }: { text: string; voice: VoiceSettings; label: string }) {
  return (
    <Button
      variant="ghost"
      className="nar-play"
      aria-label={label}
      onClick={() => speak(text, { voice })}
    >
      <ShellIconSvg name="speaker" size={18} />
      {label}
    </Button>
  );
}

/** Audio Narasi: pengaturan suara Momo untuk area anak, uji suara, dan semua teks yang dibacakan. */
export function NarrationPage() {
  const settings = useFetch<AppSettings>('staff', '/admin/settings');
  const books = useFetch<CatalogBook[]>('staff', '/admin/catalogs');
  return (
    <>
      <PageHeader title={t('admin.voice.title')} subtitle={t('admin.voice.subtitle')} />
      <Loadable loading={settings.loading} error={settings.error} hasData={!!settings.data}>
        {() => <Narration initial={settings.data!.voice} books={books.data ?? []} />}
      </Loadable>
    </>
  );
}

function Narration({ initial, books }: { initial: VoiceSettings; books: CatalogBook[] }) {
  const call = useApiCall('staff');
  const action = useAction();
  const voices = useVoices();
  const [form, setForm] = useState(initial);
  const [sample, setSample] = useState(t('admin.voice.sampleText'));
  const [bookSlug, setBookSlug] = useState('');
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const parsed = voiceSettingsSchema.safeParse(form);
  const set = <K extends keyof VoiceSettings>(k: K, v: VoiceSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => () => stopSpeaking(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const out = await action.run(
      () => call<AppSettings>('/admin/settings/voice', { method: 'PUT', body: form }),
      t('admin.voice.saved'),
    );
    if (out) {
      settingsChanged(out);
      setForm(out.voice);
    }
  }

  const book = books.find((b) => b.slug === bookSlug) ?? books[0];
  const texts = books.flatMap((b) =>
    b.topics.flatMap((x) => [x.lesson, x.tips.join('. ')].filter(Boolean)),
  );
  const totalWords = texts.reduce((n, s) => n + words(s), 0);
  const totalSeconds = texts.reduce((n, s) => n + seconds(s, form.rate), 0);

  return (
    <>
      {!supported && <Notice tone="warning">{t('admin.voice.unsupported')}</Notice>}
      {supported && voices.length === 0 && (
        <Notice tone="info">{t('admin.voice.noIdVoice')}</Notice>
      )}
      <Notice tone="info">{t('admin.voice.engineNote')}</Notice>

      <div className="ins-kpis">
        <Kpi
          i={0}
          tone="sky"
          icon={<ShellIconSvg name="book" />}
          label={t('admin.voice.kTexts')}
          value={<CountUp value={texts.length} />}
          hint={t('admin.voice.kTextsHint', { n: books.reduce((n, b) => n + b.topics.length, 0) })}
        />
        <Kpi
          i={1}
          tone="leaf"
          icon={<ShellIconSvg name="report" />}
          label={t('admin.voice.kWords')}
          value={<CountUp value={totalWords} />}
          hint={t('admin.voice.kWordsHint')}
        />
        <Kpi
          i={2}
          tone="sun"
          icon={<ShellIconSvg name="play" />}
          label={t('admin.voice.kDuration')}
          value={duration(totalSeconds)}
          hint={t('admin.voice.kDurationHint', { rate: form.rate })}
        />
        <Kpi
          i={3}
          tone="grape"
          icon={<ShellIconSvg name="speaker" />}
          label={t('admin.voice.kVoices')}
          value={<CountUp value={voices.length} />}
          hint={t('admin.voice.kVoicesHint')}
        />
      </div>

      <div className="nar-layout">
        <Card title={t('admin.voice.settingsTitle')}>
          <ActionNotice error={action.error} done={action.done} />
          <form onSubmit={submit}>
            <Checkbox
              label={t('admin.voice.enabled')}
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
            />
            <Checkbox
              label={t('admin.voice.autoRead')}
              checked={form.autoRead}
              disabled={!form.enabled}
              onChange={(e) => set('autoRead', e.target.checked)}
            />
            <p className="ui-hint">{t('admin.voice.autoReadHint')}</p>
            <div className="adm-fields">
              <TextField
                label={t('admin.voice.rate')}
                hint={t('admin.voice.rateHint')}
                type="number"
                min={0.6}
                max={1.4}
                step={0.02}
                value={String(form.rate)}
                onChange={(e) => set('rate', Number(e.target.value))}
              />
              <TextField
                label={t('admin.voice.pitch')}
                hint={t('admin.voice.pitchHint')}
                type="number"
                min={0.5}
                max={1.5}
                step={0.05}
                value={String(form.pitch)}
                onChange={(e) => set('pitch', Number(e.target.value))}
              />
              <SelectField
                label={t('admin.voice.voice')}
                hint={t('admin.voice.voiceHint')}
                value={form.voiceName}
                onChange={(e) => set('voiceName', e.target.value)}
                options={[
                  { value: '', label: t('admin.voice.voiceAuto') },
                  ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
                  ...(form.voiceName && !voices.some((v) => v.name === form.voiceName)
                    ? [{ value: form.voiceName, label: form.voiceName }]
                    : []),
                ]}
              />
            </div>
            <Button type="submit" disabled={action.busy || !parsed.success}>
              {t('admin.save')}
            </Button>
          </form>
        </Card>

        <Card title={t('admin.voice.testTitle')}>
          <TextArea
            className="adm-textarea"
            label={t('admin.voice.testText')}
            rows={3}
            maxLength={300}
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
          <div className="ui-row">
            <Button disabled={!parsed.success} onClick={() => speak(sample, { voice: form })}>
              <ShellIconSvg name="speaker" size={18} />
              {t('admin.voice.play')}
            </Button>
            <Button variant="secondary" onClick={() => stopSpeaking()}>
              {t('admin.voice.stop')}
            </Button>
          </div>
          <p className="ui-hint">
            {t('admin.voice.testHint', { time: duration(seconds(sample, form.rate)) })}
          </p>
          <h3 className="adm-group-title">{t('admin.voice.fixedTitle')}</h3>
          <ul className="nar-lines">
            {FIXED_LINES.map((key) => {
              const text = translate('play', key);
              return (
                <li key={key}>
                  <span>{text}</span>
                  <PlayButton text={text} voice={form} label={t('admin.voice.play')} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card
        title={t('admin.voice.libraryTitle')}
        actions={
          books.length > 0 && (
            <SelectField
              label={t('admin.voice.book')}
              value={book?.slug ?? ''}
              onChange={(e) => setBookSlug(e.target.value)}
              options={books.map((b) => ({ value: b.slug, label: b.title }))}
            />
          )
        }
      >
        <p className="ui-muted">{t('admin.voice.libraryHint')}</p>
        {!book ? (
          <Empty>{t('admin.voice.libraryEmpty')}</Empty>
        ) : (
          <ul className="nar-topics">
            {book.topics.map((x) => {
              const tips = x.tips.join('. ');
              return (
                <li key={x.id}>
                  <div className="nar-topic-head">
                    <strong>
                      {x.code}. {x.title}
                    </strong>
                    <small className="ui-muted">
                      {t('admin.voice.topicMeta', {
                        words: words(x.lesson) + words(tips),
                        time: duration(seconds(`${x.lesson} ${tips}`, form.rate)),
                      })}
                    </small>
                  </div>
                  <p>{x.lesson}</p>
                  <div className="ui-row">
                    <PlayButton text={x.lesson} voice={form} label={t('admin.voice.playLesson')} />
                    {tips && (
                      <PlayButton
                        text={`${t('admin.voice.tipsIntro')} ${tips}`}
                        voice={form}
                        label={t('admin.voice.playTips')}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
