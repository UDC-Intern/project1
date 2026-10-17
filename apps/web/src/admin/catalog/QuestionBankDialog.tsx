import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BANK_DRAFT_SIZE,
  BANK_GOOD_QUESTIONS,
  BANK_MAX_CHOICES,
  BANK_MAX_QUESTIONS,
  BANK_MIN_CHOICES,
  BANK_MIN_QUESTIONS,
  bankIssues,
  bankQuestionSchema,
  type BankQuestion,
} from '@udakids/engine';
import type { CatalogBook, CatalogLevel } from '../../api/adminTypes';
import { useApiCall, useFetch } from '../../auth/useApi';
import { t } from '../../i18n';
import { Dialog } from '../../ui/Dialog';
import { Badge, Button, Notice, TextField } from '../../ui/ui';
import { ActionNotice, ConfirmDialog, Icon, Loadable, useAction, useConfirm } from '../common';
import { ImagePickerDialog } from './ImagePickerDialog';
import { VisualEditor } from './VisualEditor';

type LevelQuestions = {
  items: BankQuestion[];
  min: number;
  good: number;
  max: number;
  /** Soal contoh dari generator level, belum disimpan. */
  draft: boolean;
  /** Level bawaan yang soalnya sudah disesuaikan sebelumnya. */
  edited: boolean;
  /** Soal contoh baru bisa diambil dari generator bawaan level. */
  regenerable: boolean;
};

const blank = (): BankQuestion => ({ prompt: '', choices: ['', '', ''], answer: 0, hint: '' });
const START_COUNT = BANK_MIN_QUESTIONS;

const NO_ISSUES: readonly string[] = [];

type QuestionCardProps = {
  index: number;
  question: BankQuestion;
  issues: readonly string[];
  /** Penangan di bawah ini harus stabil (dari `useCallback`) supaya kartu tidak digambar ulang tanpa perlu. */
  onChange: (index: number, q: BankQuestion) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  /** Buka pemilih gambar dari galeri untuk soal ini. */
  onPickImage: (index: number) => void;
  canRemove: boolean;
  canDuplicate: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
};

const sameIssues = (a: readonly string[], b: readonly string[]) =>
  a === b || (a.length === b.length && a.every((m, i) => m === b[i]));

/**
 * Kartu hanya digambar ulang bila soalnya sendiri, nomornya, galatnya, atau batas tombolnya berubah. Mengetik di
 * satu soal membuat objek soal itu baru, sedangkan objek soal lain tetap sama, jadi kartu lain tidak ikut bekerja.
 */
const sameCard = (a: QuestionCardProps, b: QuestionCardProps) =>
  a.index === b.index &&
  a.question === b.question &&
  a.canRemove === b.canRemove &&
  a.canDuplicate === b.canDuplicate &&
  a.onChange === b.onChange &&
  a.onDuplicate === b.onDuplicate &&
  a.onRemove === b.onRemove &&
  a.onPickImage === b.onPickImage &&
  a.inputRef === b.inputRef &&
  sameIssues(a.issues, b.issues);

/** Satu soal: pertanyaan, pilihan jawaban (satu benar), dan petunjuk. */
const QuestionCard = memo(function QuestionCard({
  index,
  question,
  issues,
  onChange,
  onDuplicate,
  onRemove,
  onPickImage,
  canRemove,
  canDuplicate,
  inputRef,
}: QuestionCardProps) {
  const n = index + 1;
  const set = (patch: Partial<BankQuestion>) => onChange(index, { ...question, ...patch });
  const setVisual = (visual: BankQuestion['visual']) => {
    const next = { ...question };
    if (visual) next.visual = visual;
    else delete next.visual;
    onChange(index, next);
  };
  const setChoice = (i: number, text: string) =>
    set({ choices: question.choices.map((c, k) => (k === i ? text : c)) });
  const removeChoice = (i: number) =>
    set({
      choices: question.choices.filter((_, k) => k !== i),
      answer:
        question.answer === i ? 0 : question.answer > i ? question.answer - 1 : question.answer,
    });

  return (
    <li className={`bank-q${issues.length > 0 ? ' is-bad' : ''}`}>
      <div className="bank-q-head">
        <span className="bank-q-no">
          <span className="adm-level-num">{n}</span>
          {t('admin.bank.question', { n })}
        </span>
        <span className="ui-row" style={{ gap: 6 }}>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canDuplicate}
            aria-label={t('admin.bank.duplicate', { n })}
            title={t('admin.bank.duplicate', { n })}
            onClick={() => onDuplicate(index)}
          >
            <Icon name="copy" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!canRemove}
            aria-label={t('admin.bank.remove', { n })}
            title={t('admin.bank.remove', { n })}
            onClick={() => onRemove(index)}
          >
            <Icon name="trash" />
          </Button>
        </span>
      </div>
      <VisualEditor
        n={n}
        visual={question.visual ?? undefined}
        onChange={setVisual}
        onGallery={() => onPickImage(index)}
      />
      <div className="ui-field">
        <label htmlFor={`bank-prompt-${n}`}>{t('admin.bank.prompt')}</label>
        <input
          id={`bank-prompt-${n}`}
          ref={inputRef}
          type="text"
          maxLength={200}
          value={question.prompt}
          aria-label={`${t('admin.bank.prompt')} ${n}`}
          onChange={(e) => set({ prompt: e.target.value })}
        />
        <small className="ui-hint">{t('admin.bank.promptHint')}</small>
      </div>
      <fieldset className="bank-choices" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="bank-choices-title">{t('admin.bank.choices')}</legend>
        <small className="ui-hint">{t('admin.bank.choicesHint')}</small>
        {question.choices.map((choice, i) => (
          <div key={i} className={`bank-choice${i === question.answer ? ' is-answer' : ''}`}>
            <label className="ui-check">
              <input
                type="radio"
                name={`bank-answer-${n}`}
                checked={i === question.answer}
                aria-label={t('admin.bank.correct', { n: i + 1 })}
                onChange={() => set({ answer: i })}
              />
            </label>
            <input
              type="text"
              maxLength={60}
              value={choice}
              aria-label={`${t('admin.bank.choiceN', { n: i + 1 })}, ${t('admin.bank.question', { n })}`}
              onChange={(e) => setChoice(i, e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={question.choices.length <= BANK_MIN_CHOICES}
              aria-label={t('admin.bank.removeChoice', { n: i + 1 })}
              title={t('admin.bank.removeChoice', { n: i + 1 })}
              onClick={() => removeChoice(i)}
            >
              <Icon name="trash" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          style={{ justifySelf: 'start' }}
          disabled={question.choices.length >= BANK_MAX_CHOICES}
          onClick={() => set({ choices: [...question.choices, ''] })}
        >
          <Icon name="plus" />
          {t('admin.bank.addChoice')}
        </Button>
      </fieldset>
      <TextField
        label={t('admin.bank.hint')}
        hint={t('admin.bank.hintHint')}
        maxLength={240}
        value={question.hint}
        aria-label={`${t('admin.bank.hint')} ${n}`}
        onChange={(e) => set({ hint: e.target.value })}
      />
      {issues.length > 0 && (
        <ul className="bank-issues">
          {issues.map((m, k) => (
            <li key={k}>{m}</li>
          ))}
        </ul>
      )}
    </li>
  );
}, sameCard);

/**
 * Bank soal sebuah level (`GET`, `PUT`, `DELETE /admin/levels/:id/questions`): soal pilihan ganda yang bisa
 * disunting admin. Level otomatis dibuka dengan 20 soal contoh dari generatornya; setelah disimpan, level memakai
 * daftar ini. Satu ronde tetap mengambil 10 soal dari bank dengan urutan pilihan diacak. Level baru bisa dimainkan
 * anak begitu bank punya cukup soal yang lengkap.
 */
export function QuestionBankDialog({
  level,
  onClose,
  onChanged,
}: {
  level: CatalogLevel;
  onClose: () => void;
  /** Dipanggil setelah soal disimpan, dikosongkan, atau dikembalikan; `message` untuk kabar di halaman. */
  onChanged: (books: CatalogBook[], message: string) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const { ask, dialog } = useConfirm();
  const loaded = useFetch<LevelQuestions>(
    'staff',
    `/admin/levels/${encodeURIComponent(level.id)}/questions`,
  );
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [initial, setInitial] = useState('[]');
  const [tried, setTried] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [draft, setDraft] = useState(false);
  /** Nomor soal (mulai 0) yang sedang memilih gambar dari galeri; null bila pemilih tertutup. */
  const [picking, setPicking] = useState<number | null>(null);
  /** Jumlah soal contoh terakhir yang diambil dari generator (untuk catatan "hanya sekian soal berbeda"). */
  const [drawn, setDrawn] = useState(0);
  const firstInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loaded.data) return;
    const start =
      loaded.data.items.length > 0 ? loaded.data.items : Array.from({ length: START_COUNT }, blank);
    setItems(start);
    // Soal kosong awal bukan "perubahan": yang dihitung hanya yang ditulis admin.
    setInitial(JSON.stringify(loaded.data.items.length > 0 ? start : []));
    setDraft(loaded.data.draft);
    setDrawn(loaded.data.draft ? loaded.data.items.length : 0);
  }, [loaded.data]);

  useEffect(() => {
    if (loaded.data) firstInput.current?.focus();
  }, [loaded.data]);

  const check = bankIssues(items);
  const complete = items.filter((q) => bankQuestionSchema.safeParse(q).success).length;
  const dirty = JSON.stringify(items.some((q) => q.prompt.trim() !== '') ? items : []) !== initial;
  const percent = Math.min(100, Math.round((complete / BANK_GOOD_QUESTIONS) * 100));
  const hasBank = level.source === 'bank';

  // Penangan stabil: memakai pembaruan fungsional, jadi tidak bergantung pada daftar soal yang sedang tampil.
  const setItem = useCallback(
    (i: number, q: BankQuestion) => setItems((xs) => xs.map((x, k) => (k === i ? q : x))),
    [],
  );
  const duplicateItem = useCallback(
    (i: number) =>
      setItems((xs) => [...xs.slice(0, i + 1), structuredClone(xs[i]!), ...xs.slice(i + 1)]),
    [],
  );
  const removeItem = useCallback((i: number) => setItems((xs) => xs.filter((_, k) => k !== i)), []);
  const pickImage = useCallback((i: number) => setPicking(i), []);
  const setFirstInput = useCallback((el: HTMLInputElement | null) => {
    firstInput.current = el;
  }, []);

  async function close() {
    if (dirty) {
      const yes = await ask({
        title: t('admin.bank.discardTitle'),
        message: t('admin.bank.discard'),
        confirmLabel: t('admin.bank.discardYes'),
        cancelLabel: t('admin.bank.discardNo'),
      });
      if (!yes) return;
    }
    onClose();
  }

  const endpoint = `/admin/levels/${encodeURIComponent(level.id)}/questions`;
  const canRegenerate = loaded.data?.regenerable === true;
  const canRevert = !level.custom && loaded.data?.edited === true;
  const canClear = level.custom && hasBank && !level.used;

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!check.ok) return;
    const out = await action.run(() =>
      call<CatalogBook[]>(endpoint, { method: 'PUT', body: { items } }),
    );
    if (out) onChanged(out, t('admin.bank.saved', { n: level.number, count: items.length }));
  }

  async function clear() {
    const out = await action.run(() => call<CatalogBook[]>(endpoint, { method: 'DELETE' }));
    setClearing(false);
    if (out) onChanged(out, t('admin.bank.cleared', { n: level.number }));
  }

  /** Soal yang disesuaikan dihapus; level memakai soal bawaannya lagi. */
  async function revert() {
    const out = await action.run(() => call<CatalogBook[]>(endpoint, { method: 'DELETE' }));
    setReverting(false);
    if (out) onChanged(out, t('admin.bank.reverted', { n: level.number }));
  }

  /** Ambil 20 soal contoh baru dari generator bawaan (urutan acak berbeda); belum disimpan. */
  async function regenerate() {
    if (dirty) {
      const yes = await ask({
        title: t('admin.bank.regenerateTitle'),
        message: t('admin.bank.regenerateConfirm'),
        confirmLabel: t('admin.bank.regenerateYes'),
        cancelLabel: t('admin.bank.regenerateNo'),
      });
      if (!yes) return;
    }
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    const out = await action.run(() =>
      call<LevelQuestions>(`${endpoint}?from=generator&seed=${seed}`),
    );
    if (!out || out.items.length === 0) return;
    setItems(out.items);
    setDraft(true);
    setDrawn(out.items.length);
    setTried(false);
  }

  return (
    <>
      <Dialog
        wide
        title={t('admin.bank.title', { n: level.number, title: level.title })}
        onClose={close}
      >
        <Loadable loading={loaded.loading} error={loaded.error} hasData={!!loaded.data}>
          {() => (
            <form onSubmit={save} noValidate>
              <div className="bank-head">
                <p className="ui-muted">{t('admin.bank.subtitle')}</p>
                <div className="ui-row">
                  <Badge tone={complete >= BANK_MIN_QUESTIONS ? 'success' : 'warning'}>
                    {t('admin.bank.progress', { ok: complete, n: items.length })}
                  </Badge>
                  <small className="ui-hint">
                    {complete >= BANK_MIN_QUESTIONS
                      ? t('admin.bank.ready')
                      : t('admin.bank.need', {
                          min: BANK_MIN_QUESTIONS,
                          good: BANK_GOOD_QUESTIONS,
                        })}
                  </small>
                </div>
                <div className="bank-meter" aria-hidden>
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
              {draft && (
                <Notice tone="info">
                  {t('admin.bank.draftNote', { count: drawn })}
                  {drawn < BANK_DRAFT_SIZE && (
                    <>
                      <br />
                      {t('admin.bank.draftFew', { count: drawn })}
                    </>
                  )}
                </Notice>
              )}
              {!draft && loaded.data?.edited && (
                <p className="ui-hint">{t('admin.bank.editedNote')}</p>
              )}
              <ol className="bank-list">
                {items.map((q, i) => (
                  <QuestionCard
                    key={i}
                    index={i}
                    question={q}
                    issues={tried ? (check.byQuestion.get(i) ?? NO_ISSUES) : NO_ISSUES}
                    onChange={setItem}
                    onDuplicate={duplicateItem}
                    onRemove={removeItem}
                    onPickImage={pickImage}
                    canRemove={items.length > 1}
                    canDuplicate={items.length < BANK_MAX_QUESTIONS}
                    inputRef={i === 0 ? setFirstInput : undefined}
                  />
                ))}
              </ol>
              <Button
                variant="secondary"
                disabled={items.length >= BANK_MAX_QUESTIONS}
                onClick={() => setItems((xs) => [...xs, blank()])}
              >
                <Icon name="plus" />
                {t('admin.bank.add')}
              </Button>
              {tried && (check.general.length > 0 || !check.ok) && (
                <div style={{ marginTop: 14 }}>
                  <Notice tone="error">
                    {t('admin.bank.issues')}
                    {check.general.length > 0 && (
                      <ul className="syl-errors">
                        {check.general.map((m, k) => (
                          <li key={k}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </Notice>
                </div>
              )}
              <ActionNotice error={action.error} />
              <div className="dlg-actions">
                <span className="bank-side">
                  {canRegenerate && (
                    <Button
                      variant="secondary"
                      disabled={action.busy}
                      onClick={() => void regenerate()}
                    >
                      {t('admin.bank.regenerate')}
                    </Button>
                  )}
                  {canRevert && (
                    <Button
                      variant="danger"
                      disabled={action.busy}
                      onClick={() => setReverting(true)}
                    >
                      {t('admin.bank.revert')}
                    </Button>
                  )}
                  {canClear && (
                    <Button
                      variant="danger"
                      disabled={action.busy}
                      onClick={() => setClearing(true)}
                    >
                      {t('admin.bank.clear')}
                    </Button>
                  )}
                </span>
                <Button variant="ghost" onClick={close}>
                  {t('admin.bank.close')}
                </Button>
                <Button type="submit" disabled={action.busy}>
                  <Icon name="check" />
                  {action.busy ? t('admin.bank.saving') : t('admin.bank.save')}
                </Button>
              </div>
            </form>
          )}
        </Loadable>
      </Dialog>
      {picking !== null && items[picking] && (
        <ImagePickerDialog
          n={picking + 1}
          onClose={() => setPicking(null)}
          onPick={({ url, label }) => {
            setItem(picking, { ...items[picking]!, visual: { kind: 'image', url, label } });
            setPicking(null);
          }}
        />
      )}
      <ConfirmDialog
        open={reverting}
        title={t('admin.bank.revertTitle', { n: level.number })}
        message={t('admin.bank.revertText')}
        confirmLabel={t('admin.bank.revert')}
        busy={action.busy}
        onConfirm={() => void revert()}
        onCancel={() => setReverting(false)}
      />
      <ConfirmDialog
        open={clearing}
        title={t('admin.bank.clearTitle', { n: level.number })}
        message={t('admin.bank.clearText')}
        confirmLabel={t('admin.bank.clear')}
        busy={action.busy}
        onConfirm={() => void clear()}
        onCancel={() => setClearing(false)}
      />
      {dialog}
    </>
  );
}
