import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X, LoaderCircle, Crown, WifiOff } from 'lucide-react';
import type { PublicPlayer } from '../../../shared/types';
import { useGame } from '../store/game';
export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function ActionButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const disabled = useGame((s) => s.busy || s.connection !== 'connected' || s.restoring);
  return (
    <Button {...props} disabled={props.disabled || disabled}>
      {useGame((s) => s.busy) ? <LoaderCircle size={18} className="spin" /> : null}
      {children}
    </Button>
  );
}
export function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
        <div className="eyebrow">LET THE MIND GAMES BEGIN</div>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
export function Avatar({
  player,
  size = '',
}: {
  player: Pick<PublicPlayer, 'color' | 'name'>;
  size?: string;
}) {
  return (
    <span className={`avatar avatar-${player.color % 6} ${size}`} aria-hidden="true">
      <span>{player.name.slice(0, 1).toUpperCase()}</span>
      <i />
      <i />
    </span>
  );
}
export function PlayerLine({
  player,
  host,
  you,
  children,
}: {
  player: PublicPlayer;
  host?: boolean;
  you?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`player-line ${!player.active ? 'eliminated' : ''}`}>
      <Avatar player={player} />
      <div className="player-name">
        <strong>
          {player.name} {you && <small>(you)</small>}
        </strong>
        <span>
          {!player.connected ? (
            <>
              <WifiOff size={11} /> Reconnecting
            </>
          ) : !player.active ? (
            'Spectating'
          ) : host ? (
            <>
              <Crown size={11} /> Room host
            </>
          ) : (
            'Ready for trouble'
          )}
        </span>
      </div>
      {children}
    </div>
  );
}
