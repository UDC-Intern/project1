/** Pilihan jawaban: grid 2 x 2 tombol besar (tinggi minimal 96 px). */
export function AnswerOptions({
  options,
  onPick,
  disabled,
  chosen,
  correctAnswer,
}: {
  options: string[];
  onPick: (value: string) => void;
  disabled: boolean;
  chosen?: string | null;
  /** Diisi hanya setelah anak menjawab belum tepat. */
  correctAnswer?: string | null;
}) {
  return (
    <div className="uk-options">
      {options.map((option) => {
        let state: 'correct' | 'retry' | undefined;
        if (chosen === option) state = correctAnswer ? 'retry' : 'correct';
        else if (correctAnswer === option) state = 'correct';
        return (
          <button
            key={option}
            type="button"
            className="uk-option"
            data-state={state}
            disabled={disabled}
            onClick={() => onPick(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
