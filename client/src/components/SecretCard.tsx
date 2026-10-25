import { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, EyeOff, ShieldCheck, VenetianMask } from 'lucide-react';
import { useGame } from '../store/game';
export function SecretCard({
  compact = false,
  onReveal,
}: {
  compact?: boolean;
  onReveal?: () => void;
}) {
  const me = useGame((s) => s.me);
  const [show, setShow] = useState(false);
  function reveal() {
    setShow(true);
    onReveal?.();
  }
  return (
    <motion.button
      type="button"
      className={`secret-card ${compact ? 'secret-compact' : ''} ${show ? 'is-revealed' : ''} ${me?.role === 'imposter' && show ? 'imposter-card' : ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        reveal();
      }}
      onPointerUp={() => setShow(false)}
      onPointerCancel={() => setShow(false)}
      onLostPointerCapture={() => setShow(false)}
      onBlur={() => setShow(false)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          reveal();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setShow(false);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={show ? 'Release to hide your secret' : 'Press and hold to reveal your secret'}
    >
      {show ? (
        <motion.div
          key="revealed"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="secret-icon">
            {me?.role === 'imposter' ? (
              <VenetianMask size={compact ? 22 : 44} />
            ) : (
              <ShieldCheck size={compact ? 22 : 44} />
            )}
          </span>
          <span className="eyebrow">
            {me?.role === 'imposter' ? 'YOU ARE THE IMPOSTER' : 'YOU ARE AN AGENT'}
          </span>
          <strong>{me?.role === 'imposter' ? 'Act natural.' : me?.word}</strong>
          {!compact && (
            <p>
              {me?.role === 'imposter'
                ? 'You don’t know the word. Listen closely, blend in, and stay undetected.'
                : 'This is your secret word. Give a subtle clue and find the one who’s faking it.'}
            </p>
          )}
          <small>
            <EyeOff size={13} /> Release to hide
          </small>
        </motion.div>
      ) : (
        <div>
          <span className="secret-icon">
            <Fingerprint size={compact ? 22 : 56} />
          </span>
          <span className="eyebrow">{compact ? 'YOUR SECRET' : 'FOR YOUR EYES ONLY'}</span>
          <strong>{compact ? 'Hold to peek' : 'Who are you, really?'}</strong>
          {!compact && (
            <p>
              Make sure no one is looking.
              <br />
              Press and hold to reveal your assignment.
            </p>
          )}
          <small>
            <Fingerprint size={14} /> {compact ? 'Press & hold' : 'Hold to reveal'}
          </small>
        </div>
      )}
    </motion.button>
  );
}
