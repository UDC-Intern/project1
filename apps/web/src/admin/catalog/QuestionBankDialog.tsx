import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
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
import { ActionNotice, ConfirmDialog, Icon, Loadable, confirmAction, useAction } from '../common';

type LevelQuestions = { items: BankQuestion[]; min: number; good: number; max: number };

const blank = (): BankQuestion => ({ prompt: '', choices: ['', '', ''], answer: 0, hint: '' });
const START_COUNT = BANK_MIN_QUESTIONS;

/** Satu soal: pertanyaan, pilihan jawaban (satu benar), dan petunjuk. */
function QuestionCard({
  index,
  question,
  issues,
  onChange,
  onDuplicate,
  onRemove,
  canRemove,
  canDuplicate,
  inputRef,
}: {
  index: number;
  question: BankQuestion;
  issues: string[];
  onChange: (q: BankQuestion) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
  canDuplicate: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const n = index + 1;
  const set = (patch: Partial<BankQuestion>) => onChange({ ...question, ...patch });
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
            onClick={onDuplicate}
          >
            <Icon name="copy" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!canRemove}
            aria-label={t('admin.bank.remove', { n })}
            title={t('admin.bank.remove', { n })}
            onClick={onRemove}
          >
            <Icon name="trash" />
          </Button>
        </span>
      </div>
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
}

/**
 * Bank soal sebuah level buatan admin (`GET`, `PUT`, `DELETE /admin/levels/:id/questions`): soal pilihan ganda
 * yang ditulis sendiri. Satu ronde mengambil 10 soal dari bank dengan urutan pilihan diacak. Level baru bisa
 * dimainkan anak begitu bank punya cukup soal yang lengkap.
 */
export function QuestionBankDialog({
  level,
  onClose,
  onChanged,
}: {
  level: CatalogLevel;
  onClose: () => void;
  /** Dipanggil setelah soal disimpan atau dikosongkan. `count` = jumlah soal sekarang. */
  onChanged: (books: CatalogBook[], count: number) => void;
}) {
  const call = useApiCall('staff');
  const action = useAction();
  const loaded = useFetch<LevelQuestions>(
    'staff',
    `/admin/levels/${encodeURIComponent(level.id)}/questions`,
  );
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [initial, setInitial] = useState('[]');
  const [tried, setTried] = useState(false);
  const [clearing, setClearing] = useState(false);
  const firstInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loaded.data) return;
    const start =
      loaded.data.items.length > 0 ? loaded.data.items : Array.from({ length: START_COUNT }, blank);
    setItems(start);
    // Soal kosong awal bukan "perubahan": yang dihitung hanya yang ditulis admin.
    setInitial(JSON.stringify(loaded.data.items.length > 0 ? start : []));
  }, [loaded.data]);

  useEffect(() => {
    if (loaded.data) firstInput.current?.focus();
  }, [loaded.data]);

  const check = bankIssues(items);
  const complete = items.filter((q) => bankQuestionSchema.safeParse(q).success).length;
  const dirty = JSON.stringify(items.some((q) => q.prompt.trim() !== '') ? items : []) !== initial;
  const percent = Math.min(100, Math.round((complete / BANK_GOOD_QUESTIONS) * 100));
  const hasBank = level.source === 'bank';

  const setItem = (i: number, q: BankQuestion) =>
    setItems((xs) => xs.map((x, k) => (k === i ? q : x)));

  function close() {
    if (dirty && !confirmAction(t('admin.bank.discard'))) return;
    onClose();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!check.ok) return;
    const out = await action.run(() =>
      call<CatalogBook[]>(`/admin/levels/${encodeURIComponent(level.id)}/questions`, {
        method: 'PUT',
        body: { items },
      }),
    );
    if (out) onChanged(out, items.length);
  }

  async function clear() {
    const out = await action.run(() =>
      call<CatalogBook[]>(`/admin/levels/${encodeURIComponent(level.id)}/questions`, {
        method: 'DELETE',
      }),
    );
    setClearing(false);
    if (out) onChanged(out, 0);
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
              <ol className="bank-list">
                {items.map((q, i) => (
                  <QuestionCard
                    key={i}
                    index={i}
                    question={q}
                    issues={tried ? (check.byQuestion.get(i) ?? []) : []}
                    onChange={(next) => setItem(i, next)}
                    onDuplicate={() =>
                      setItems((xs) => [
                        ...xs.slice(0, i + 1),
                        structuredClone(q),
                        ...xs.slice(i + 1),
                      ])
                    }
                    onRemove={() => setItems((xs) => xs.filter((_, k) => k !== i))}
                    canRemove={items.length > 1}
                    canDuplicate={items.length < BANK_MAX_QUESTIONS}
                    inputRef={
                      i === 0
                        ? (el) => {
                            firstInput.current = el;
                          }
                        : undefined
                    }
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
                {hasBank && !level.used && (
                  <Button
                    variant="danger"
                    disabled={action.busy}
                    onClick={() => setClearing(true)}
                    style={{ marginRight: 'auto' }}
                  >
                    {t('admin.bank.clear')}
                  </Button>
                )}
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
      <ConfirmDialog
        open={clearing}
        title={t('admin.bank.clearTitle', { n: level.number })}
        message={t('admin.bank.clearText')}
        confirmLabel={t('admin.bank.clear')}
        busy={action.busy}
        onConfirm={() => void clear()}
        onCancel={() => setClearing(false)}
      />
    </>
  );
}
