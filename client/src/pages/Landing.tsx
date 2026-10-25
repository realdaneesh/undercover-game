import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Plus,
  KeyRound,
  Users,
  Globe2,
  Zap,
  Fingerprint,
  MessagesSquare,
  Vote,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { DEFAULT_SETTINGS, type Settings as GameSettings } from '../../../shared/types';
import { useGame } from '../store/game';
import { ActionButton, Button, Modal } from '../components/UI';
import { Settings } from '../components/Settings';
import { SpyScene } from '../components/SpyScene';

export function Landing() {
  const invite =
    new URLSearchParams(window.location.search)
      .get('room')
      ?.toUpperCase()
      .replace(/[^A-Z2-9]/g, '')
      .slice(0, 6) ?? '';
  const [modal, setModal] = useState<'create' | 'join' | null>(invite ? 'join' : null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(invite);
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const action = useGame((s) => s.action);
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  function open(type: 'create' | 'join') {
    useGame.getState().clearError();
    setModal(type);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const success = await action(
      modal === 'create'
        ? { type: 'create', name: name.trim(), settings }
        : { type: 'join', code: code.trim().toUpperCase(), name: name.trim() },
    );
    if (success) {
      window.history.replaceState({}, '', window.location.pathname);
      setModal(null);
    }
  }
  return (
    <>
      <section className="hero">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="hero-kicker">
            <span className="live-dot" /> A PARTY GAME OF BEAUTIFUL DECEPTION
          </div>
          <h1>
            Good friends.
            <br />
            Bad{' '}
            <span>
              alibis
              <svg viewBox="0 0 330 20" preserveAspectRatio="none">
                <path d="M4 13Q170-5 326 10M35 19Q170 6 292 14" />
              </svg>
            </span>
            .
          </h1>
          <p>
            One secret word. One convincing liar.
            <br />
            Read the room, drop your clues, and find out
            <br className="desktop-break" /> who’s a little <em>too</em> good at pretending.
          </p>
          <div className="hero-facts">
            <span>
              <Users size={16} />
              3–12 friends
            </span>
            <i />
            <span>
              <Zap size={16} />
              5–10 minutes
            </span>
            <i />
            <span>
              <Globe2 size={16} />
              Play anywhere
            </span>
          </div>
          <div className="hero-note">
            <ShieldCheck size={14} /> No downloads. No accounts. Just suspicion.
          </div>
        </motion.div>
        <SpyScene />
      </section>
      <section className="entry-grid" aria-label="Start playing">
        <motion.button
          whileHover={{ y: -4 }}
          className="entry-card create-card"
          onClick={() => open('create')}
        >
          <span className="entry-icon">
            <Plus size={27} />
          </span>
          <div className="entry-copy">
            <span className="eyebrow">BE THE INSTIGATOR</span>
            <h2>Create a room</h2>
            <p>Gather your crew. Set the trap.</p>
          </div>
          <span className="entry-arrow">
            <ArrowUpRight />
          </span>
        </motion.button>
        <motion.button
          whileHover={{ y: -4 }}
          className="entry-card join-card"
          onClick={() => open('join')}
        >
          <span className="entry-icon">
            <KeyRound size={25} />
          </span>
          <div className="entry-copy">
            <span className="eyebrow">GOT AN INVITATION?</span>
            <h2>Join a room</h2>
            <p>Enter a code. Bring your poker face.</p>
          </div>
          <span className="entry-arrow">
            <ArrowRight />
          </span>
        </motion.button>
      </section>
      <section className="how-section" id="how-to-play">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE BRIEFING</span>
            <h2>
              Easy to learn.<span> Hard to trust.</span>
            </h2>
          </div>
          <span className="section-aside">Your next “one more round” starts here.</span>
        </div>
        <div className="how-grid">
          {[
            {
              number: '01',
              icon: Fingerprint,
              title: 'Keep a secret',
              text: 'Everyone gets a word. One of you gets nothing but the nerve to fake it.',
              color: 'violet',
            },
            {
              number: '02',
              icon: MessagesSquare,
              title: 'Make it believable',
              text: 'Take turns giving a short clue. Say enough to fit in. Never give the word away.',
              color: 'cyan',
            },
            {
              number: '03',
              icon: Vote,
              title: 'Call their bluff',
              text: 'Talk it out, then vote. Catch the Imposter before they crack your secret.',
              color: 'pink',
            },
          ].map((step) => (
            <div className={`how-step ${step.color}`} key={step.number}>
              <div className="step-top">
                <span className="step-icon">
                  <step.icon size={22} />
                </span>
                <span className="step-number">{step.number}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="landing-bottom">
        <span className="tiny-mask">✦</span>
        <p>A little doubt makes a great night.</p>
        <span className="tiny-mask">✦</span>
      </div>
      {modal && (
        <Modal
          title={modal === 'create' ? 'Your room. Your rules.' : 'You’re on the list.'}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <p className="modal-description">
            {modal === 'create'
              ? 'Pick a name, set the scene, and invite your favorite suspects.'
              : 'A six-character code is all that stands between you and trouble.'}
          </p>
          <form onSubmit={submit}>
            <label className="field-label" htmlFor="nickname">
              Your nickname
            </label>
            <input
              id="nickname"
              autoFocus
              autoComplete="nickname"
              placeholder="What should we call you?"
              minLength={2}
              maxLength={18}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
            />
            {modal === 'create' ? (
              <Settings value={settings} onChange={setSettings} disabled={busy} />
            ) : (
              <>
                <label className="field-label" htmlFor="room-code">
                  Room code
                </label>
                <input
                  className="code-input"
                  id="room-code"
                  autoComplete="off"
                  placeholder="ABC123"
                  minLength={6}
                  maxLength={6}
                  pattern="[A-Z2-9]{6}"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                  required
                  disabled={busy}
                />
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <ActionButton className="full-width" type="submit">
              {modal === 'create' ? 'Create my room' : 'Join the room'}
              <ArrowRight size={18} />
            </ActionButton>
            <p className="form-footnote">
              {modal === 'create'
                ? 'Private room · Only people with your code can join'
                : 'Make sure your friends are waiting in the lobby.'}
            </p>
          </form>
        </Modal>
      )}
    </>
  );
}
