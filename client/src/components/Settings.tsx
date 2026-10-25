import { CATEGORIES, type Settings as GameSettings } from '../../../shared/types';
import { Timer, Shapes, VenetianMask, Check } from 'lucide-react';
export function Settings({
  value,
  onChange,
  disabled = false,
}: {
  value: GameSettings;
  onChange: (s: GameSettings) => void;
  disabled?: boolean;
}) {
  return (
    <div className="settings">
      <div className="field-label">
        <VenetianMask size={15} /> Game mode
      </div>
      <div className="mode-selected">
        <span className="mode-symbol">
          <VenetianMask />
        </span>
        <div>
          <strong>Classic Imposter</strong>
          <small>One secret. One liar. Trust your instincts.</small>
        </div>
        <Check size={18} />
        <span className="mini-tag">3–12</span>
      </div>
      <label className="field-label" htmlFor="category">
        <Shapes size={15} /> Word category
      </label>
      <select
        id="category"
        value={value.category}
        onChange={(e) =>
          onChange({ ...value, category: e.target.value as GameSettings['category'] })
        }
        disabled={disabled}
      >
        <option>All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <div className="field-label">
        <Timer size={15} /> Time per clue
      </div>
      <div className="timer-options">
        {([20, 30, 45, 60] as const).map((n) => (
          <button
            type="button"
            disabled={disabled}
            className={value.clueSeconds === n ? 'selected' : ''}
            aria-pressed={value.clueSeconds === n}
            key={n}
            onClick={() => onChange({ ...value, clueSeconds: n })}
          >
            {n}
            <small>sec</small>
          </button>
        ))}
      </div>
    </div>
  );
}
