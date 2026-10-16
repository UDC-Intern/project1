/**
 * Pilihan jawaban. Mengetuk pilihan langsung menjawab, tanpa tombol periksa. Setelah dinilai: tepat hijau,
 * belum tepat kuning, dan jawaban yang benar ikut ditandai hijau. Tidak pernah merah.
 */
export function AnswerOptions({
  options,
  selected,
  onSelect,
  disabled,
  result,
}: {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled: boolean;
  result?: { chosen: string; isCorrect: boolean; correctAnswer: string | null } | null;
}) {
  return (
    <div className="choices" role="group">
      {options.map((option) => {
        let state = '';
        if (result) {
          if (result.chosen === option) state = result.isCorrect ? ' is-right' : ' is-wrong';
          else if (result.correctAnswer === option) state = ' is-answer';
        } else if (selected === option) {
          state = ' is-selected';
        }
        return (
          <button
            key={option}
            type="button"
            className={`choice${state}`}
            aria-pressed={!result && selected === option}
            disabled={disabled}
            onClick={() => onSelect(option)}
          >
            <span className="choice-text">{option}</span>
          </button>
        );
      })}
    </div>
  );
}
