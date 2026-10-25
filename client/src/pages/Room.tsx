import { useState, type FormEvent, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  Crown,
  Hash,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Timer,
  Users,
  Vote,
  X,
  Sparkles,
  VenetianMask,
  CircleHelp,
  Radio,
  LogOut,
} from 'lucide-react';
import type { PublicRoom } from '../../../shared/types';
import { useGame } from '../store/game';
import { useCountdown } from '../hooks/useCountdown';
import { ActionButton, Avatar, Button, Modal, PlayerLine } from '../components/UI';
import { Settings } from '../components/Settings';
import { SecretCard } from '../components/SecretCard';

function Countdown({ room, label = 'remaining' }: { room: PublicRoom; label?: string }) {
  const seconds = useCountdown(room.deadline);
  return (
    <div
      className={`countdown ${seconds <= 10 ? 'urgent' : ''}`}
      aria-label={`${seconds} seconds ${label}`}
    >
      <Timer size={17} />
      <strong>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </strong>
      <span>{label}</span>
    </div>
  );
}
function Roster({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const busy = useGame((s) => s.busy);
  return (
    <div className="panel roster-panel">
      <div className="panel-heading">
        <h3>
          <Users size={17} /> The usual suspects
        </h3>
        <span className="count-badge">{room.players.length}/12</span>
      </div>
      <div className="roster-list">
        {room.players.map((p) => (
          <PlayerLine key={p.id} player={p} host={room.hostId === p.id} you={me?.id === p.id}>
            {room.phase === 'LOBBY' && room.hostId === me?.id && p.id !== me?.id ? (
              <button
                title={`Remove ${p.name}`}
                aria-label={`Remove ${p.name}`}
                className="icon-button kick-button"
                disabled={busy}
                onClick={() => action({ type: 'kick', playerId: p.id })}
              >
                <X size={14} />
              </button>
            ) : room.turnId === p.id ? (
              <span className="turn-indicator">Their turn</span>
            ) : room.phase === 'ROLE_REVEAL' && p.ready ? (
              <Check className="text-cyan" size={17} />
            ) : room.phase === 'CLUE_ROUND' &&
              room.clues.some((c) => c.round === room.round && c.playerId === p.id) ? (
              <Check className="text-cyan" size={17} />
            ) : (
              <span className={`presence ${p.connected ? 'online' : ''}`} />
            )}
          </PlayerLine>
        ))}
      </div>
      {room.phase === 'LOBBY' && (
        <div className="roster-bottom">
          <span className="live-dot" /> Live updates. No refresh needed.
        </div>
      )}
    </div>
  );
}
function ClueHistory({ room }: { room: PublicRoom }) {
  return (
    <div className="panel clue-history">
      <div className="panel-heading">
        <h3>
          <MessageCircle size={17} /> The evidence
        </h3>
        <span className="count-badge">{room.clues.length} clues</span>
      </div>
      {room.clues.length === 0 ? (
        <div className="empty-evidence">
          <MessageCircle size={26} />
          <p>The first clue is always the hardest.</p>
          <small>Every clue will appear here, in real time.</small>
        </div>
      ) : (
        <div className="clue-list">
          {room.clues.map((c, i) => {
            const p = room.players.find((p) => p.id === c.playerId);
            return (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`clue-item ${c.skipped ? 'skipped' : ''}`}
                key={`${c.round}-${c.playerId}`}
              >
                <Avatar player={p ?? { name: '?', color: 0 }} />
                <div>
                  <div className="clue-byline">
                    <strong>{p?.name ?? 'Departed agent'}</strong>
                    <small>ROUND {c.round}</small>
                  </div>
                  <p>{c.skipped ? 'No clue submitted' : `“${c.text}”`}</p>
                </div>
                <span className="clue-index">{String(i + 1).padStart(2, '0')}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Lobby({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const busy = useGame((s) => s.busy);
  const isHost = room.hostId === me?.id;
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setCopyError('');
      window.setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopyError('Clipboard unavailable. Select the room code above and copy it manually.');
    }
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', room.code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'You’re a suspect. Join UNDERCOVER.',
          text: `Join my UNDERCOVER room: ${room.code}`,
          url: url.toString(),
        });
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError'))
          await copy(url.toString(), 'link');
      }
    } else await copy(url.toString(), 'link');
  }
  return (
    <div className="room-layout lobby-layout">
      <div className="room-main">
        <div className="panel invitation-panel">
          <div className="eyebrow">
            <Radio size={13} /> YOUR PRIVATE HIDEOUT
          </div>
          <h1>The crew’s coming together.</h1>
          <p>Send your friends the code. Every good alibi needs an accomplice.</p>
          <div className="room-code-row">
            <div>
              <span className="field-label">ROOM CODE</span>
              <strong className="room-code" tabIndex={0}>
                {room.code}
              </strong>
            </div>
            <div className="share-controls">
              <Button variant="secondary" onClick={() => copy(room.code, 'code')}>
                {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
              <Button variant="ghost" onClick={share}>
                <Share2 size={16} />
                {copied === 'link' ? 'Link copied' : 'Invite friends'}
              </Button>
            </div>
          </div>
          {copyError && (
            <p role="status" className="form-error">
              {copyError}
            </p>
          )}
          <div className="invite-footnote">
            <ShieldCheck size={14} /> Only people with your code can join. Up to 12 players.
          </div>
        </div>
        <div className="panel settings-panel">
          <div className="panel-heading">
            <h3>
              <CircleHelp size={17} /> The game plan
            </h3>
            <span className="mini-tag">{isHost ? 'HOST CONTROLS' : 'SET BY THE HOST'}</span>
          </div>
          <Settings
            value={room.settings}
            onChange={(settings) => action({ type: 'settings', settings })}
            disabled={!isHost || busy}
          />
          <div className="start-row">
            <p>
              {room.players.length < 3
                ? `${3 - room.players.length} more ${room.players.length === 2 ? 'friend' : 'friends'} and we’re in business.`
                : room.players.some((p) => !p.connected)
                  ? 'Waiting for everyone to reconnect.'
                  : 'Everyone’s here. Let the suspicion begin.'}
            </p>
            {isHost ? (
              <ActionButton
                disabled={room.players.length < 3 || room.players.some((p) => !p.connected)}
                onClick={() => action({ type: 'start' })}
              >
                Start the game
                <ArrowRight size={18} />
              </ActionButton>
            ) : (
              <span className="waiting-label">
                <span className="live-dot" /> Waiting for the host
              </span>
            )}
          </div>
        </div>
      </div>
      <aside>
        <Roster room={room} />
        <div className="side-note">
          <span>✦ A FRIENDLY REMINDER</span>
          <p>In here, “trust me” is usually a red flag.</p>
        </div>
      </aside>
    </div>
  );
}
function Reveal({ room }: { room: PublicRoom }) {
  const [seen, setSeen] = useState(false);
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  return (
    <div className="phase-panel reveal-panel">
      <div className="phase-top">
        <span className="eyebrow">THE ASSIGNMENT</span>
        <Countdown room={room} />
      </div>
      <h1>Every face hides a secret.</h1>
      <p>Your role is yours alone. Keep it that way.</p>
      <SecretCard onReveal={() => setSeen(true)} />
      <ActionButton disabled={!seen || me?.ready} onClick={() => action({ type: 'ready' })}>
        {me?.ready ? (
          <>
            <CheckCheck size={18} /> You’re ready. Waiting for the crew…
          </>
        ) : (
          <>
            I know my assignment
            <ArrowRight size={18} />
          </>
        )}
      </ActionButton>
      <small className="phase-footnote">
        {room.players.filter((p) => p.ready).length}/{room.players.length} ready · The first round
        starts automatically
      </small>
    </div>
  );
}
function ClueRound({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const myTurn = room.turnId === me?.id;
  const current = room.players.find((p) => p.id === room.turnId)!;
  const [text, setText] = useState('');
  const submitted = room.clues.filter((c) => c.round === room.round).length;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await action({ type: 'clue', text })) setText('');
  }
  return (
    <div className="phase-panel">
      <div className="phase-top">
        <span className="eyebrow">ROUND {String(room.round).padStart(2, '0')} / DROP A CLUE</span>
        <Countdown room={room} />
      </div>
      <div className={`turn-spotlight ${myTurn ? 'your-turn' : ''}`}>
        <Avatar player={current} size="avatar-large" />
        <span className="turn-ring" />
      </div>
      <h1>
        {myTurn ? 'Your move. Make it subtle.' : `${current?.name ?? 'An agent'} is on the spot.`}
      </h1>
      <p>
        {myTurn
          ? 'Give a short clue about the word. Enough to belong, never enough to give it away.'
          : 'Read between the lines. A little hesitation can say a lot.'}
      </p>
      {myTurn ? (
        <form className="clue-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="clue">
            Your clue
          </label>
          <div className="clue-input-wrap">
            <input
              id="clue"
              autoFocus
              autoComplete="off"
              maxLength={48}
              required
              placeholder="A very convincing clue…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span>{text.length}/48</span>
          </div>
          <ActionButton type="submit" disabled={!text.trim()}>
            <Send size={17} /> Lock in clue
          </ActionButton>
        </form>
      ) : (
        <div className="waiting-turn">
          <span className="typing-dots">
            <i />
            <i />
            <i />
          </span>
          <span>
            {room.players.find((p) => p.id === me?.id)?.active
              ? 'Keep your poker face ready.'
              : 'You’re spectating. The secrets stay with you.'}
          </span>
        </div>
      )}
      <div className="round-progress">
        <div>
          <span>
            {submitted} of {room.order.length} clues submitted
          </span>
          <span>ROUND {room.round}</span>
        </div>
        <div className="progress-track">
          <i style={{ width: `${(submitted / room.order.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
function Discussion({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  return (
    <div className="phase-panel discussion-panel">
      <div className="phase-top">
        <span className="eyebrow">LET’S TALK ABOUT IT</span>
        <Countdown room={room} />
      </div>
      <div className="phase-art cyan-art">
        <MessageCircle size={48} />
        <span>?</span>
      </div>
      <h1>Something doesn’t add up.</h1>
      <p>
        Compare the clues. Question the confidence.
        <br />
        Who’s describing the word, and who’s just describing… things?
      </p>
      <div className="discussion-prompts">
        <span>“Why did you choose that clue?”</span>
        <span>“That was suspiciously vague.”</span>
      </div>
      <p className="voice-note">
        Talk in person or on your own group call. No microphone needed here.
      </p>
      {room.hostId === me?.id ? (
        <ActionButton onClick={() => action({ type: 'discussed' })}>
          Ready to point fingers
          <Vote size={18} />
        </ActionButton>
      ) : (
        <div className="waiting-label">
          <span className="live-dot" /> The host can open voting when you’re ready.
        </div>
      )}
      <small className="phase-footnote">
        Voting opens automatically when the discussion timer ends.
      </small>
    </div>
  );
}
function Voting({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const [selected, setSelected] = useState('');
  const active = room.players.filter((p) => p.active);
  const eligible = active.some((p) => p.id === me?.id);
  return (
    <div className="phase-panel voting-panel">
      <div className="phase-top">
        <span className="eyebrow">
          {room.revote ? 'ONE LAST VOTE / TIEBREAKER' : 'THE MOMENT OF TRUTH'}
        </span>
        <Countdown room={room} />
      </div>
      <h1>
        {me?.voted
          ? 'Your suspicion is sealed.'
          : room.revote
            ? 'A tie. Let’s settle this.'
            : 'Who’s fooling everyone?'}
      </h1>
      <p>
        {me?.voted
          ? 'No changing sides now. The results stay hidden until voting closes.'
          : !eligible
            ? 'Watch the verdict unfold. Eliminated agents can’t vote.'
            : room.revote
              ? 'Only the tied suspects are on the ballot. Another tie means nobody leaves.'
              : 'Pick one suspect. Your vote is private, final, and probably personal.'}
      </p>
      <div className="vote-grid">
        {active
          .filter((p) => room.candidates.includes(p.id))
          .map((p) => (
            <button
              type="button"
              className={`vote-card ${selected === p.id ? 'selected' : ''}`}
              key={p.id}
              disabled={!eligible || me?.voted || p.id === me?.id}
              onClick={() => setSelected(p.id)}
              aria-pressed={selected === p.id}
            >
              <Avatar player={p} />
              <strong>{p.name}</strong>
              <small>
                {p.id === me?.id
                  ? 'That’s you'
                  : selected === p.id
                    ? 'Your suspect'
                    : 'Select suspect'}
              </small>
              <span className="vote-radio">{selected === p.id && <Check size={12} />}</span>
            </button>
          ))}
      </div>
      {eligible && !me?.voted && (
        <ActionButton
          disabled={!selected}
          onClick={() => action({ type: 'vote', playerId: selected })}
        >
          <Vote size={18} /> Lock in my vote
        </ActionButton>
      )}
      {me?.voted && (
        <div className="vote-locked">
          <ShieldCheck size={20} /> Vote locked. Secrets safe.
        </div>
      )}
      <div className="round-progress">
        <div>
          <span>
            {room.voteCount} of {active.length} votes locked in
          </span>
          <span>
            <EyeDot /> PRIVATE BALLOT
          </span>
        </div>
        <div className="progress-track">
          <i style={{ width: `${(room.voteCount / active.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
function EyeDot() {
  return <span className="small-dot" />;
}
function Results({ room }: { room: PublicRoom }) {
  const result = room.result!;
  const eliminated = room.players.find((p) => p.id === result.eliminatedId);
  const max = Math.max(1, ...Object.values(result.counts));
  return (
    <div className="phase-panel results-panel">
      <div className="phase-top">
        <span className="eyebrow">THE VERDICT IS IN</span>
        <Countdown room={room} label="until next phase" />
      </div>
      <div className={`phase-art ${result.wasImposter ? 'pink-art' : ''}`}>
        {eliminated ? <Avatar player={eliminated} size="avatar-large" /> : <Vote size={42} />}
      </div>
      <h1>{eliminated ? `${eliminated.name} is out.` : 'Suspicion is divided.'}</h1>
      <p>
        {eliminated
          ? result.wasImposter
            ? 'You caught the Imposter. But they have one last trick: guessing the secret word.'
            : 'An innocent agent. The Imposter is still among you.'
          : result.revote
            ? 'Another tie. Nobody is eliminated. New clues, fresh suspicions.'
            : 'Nobody is eliminated yet. One tiebreaker vote will decide.'}
      </p>
      <div className="tally-list">
        {Object.entries(result.counts)
          .sort((a, b) => b[1] - a[1])
          .map(([id, count]) => {
            const p = room.players.find((p) => p.id === id);
            return (
              <div className="tally-row" key={id}>
                <span>{p?.name ?? 'Departed agent'}</span>
                <div>
                  <motion.i
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / max) * 100}%` }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
      </div>
      <small className="phase-footnote">The next phase starts automatically.</small>
    </div>
  );
}
function FinalGuess({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const [guess, setGuess] = useState('');
  const imposter = room.players.find((p) => p.id === room.result?.eliminatedId);
  const isImposter = me?.role === 'imposter';
  async function submit(e: FormEvent) {
    e.preventDefault();
    await action({ type: 'guess', text: guess });
  }
  return (
    <div className="phase-panel final-panel">
      <div className="phase-top">
        <span className="eyebrow">ONE LAST CHANCE</span>
        <Countdown room={room} />
      </div>
      <div className="phase-art pink-art">
        <VenetianMask size={48} />
      </div>
      <h1>
        {isImposter
          ? 'Caught. Not beaten.'
          : `${imposter?.name ?? 'The Imposter'} has one last shot.`}
      </h1>
      <p>
        {isImposter
          ? 'They found you. Now find their word. One correct guess steals the win.'
          : 'The Imposter can still steal the win by guessing your secret word. Hold your breath.'}
      </p>
      {isImposter ? (
        <form className="clue-form guess-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="guess">
            Guess the secret word
          </label>
          <input
            id="guess"
            autoFocus
            autoComplete="off"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            maxLength={48}
            placeholder="What was their secret word?"
            required
          />
          <ActionButton type="submit" disabled={!guess.trim()}>
            Take the shot
            <ArrowRight size={18} />
          </ActionButton>
        </form>
      ) : (
        <div className="waiting-turn">
          <span className="typing-dots">
            <i />
            <i />
            <i />
          </span>
          <span>The last word could change everything.</span>
        </div>
      )}
      <small className="phase-footnote">One guess. No second chances.</small>
    </div>
  );
}
function GameOver({ room }: { room: PublicRoom }) {
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const agentsWin = room.winner === 'agents';
  const personalWin = agentsWin ? me?.role === 'agent' : me?.role === 'imposter';
  const imposter = room.players.find((p) => p.id === room.imposterId);
  return (
    <div className="phase-panel gameover-panel">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ '--i': i, '--x': `${(i * 37 + 7) % 100}%` } as CSSProperties} />
        ))}
      </div>
      <span className="eyebrow">
        {personalWin ? 'NICELY PLAYED, AGENT.' : 'THERE’S ALWAYS ANOTHER ROUND.'}
      </span>
      <div className={`phase-art ${agentsWin ? 'cyan-art' : 'pink-art'}`}>
        <Sparkles size={48} />
      </div>
      <h1>{agentsWin ? 'The truth wins.' : 'A beautiful deception.'}</h1>
      <p>{room.reason}</p>
      <div className="winner-pill">
        {agentsWin ? <ShieldCheck size={17} /> : <VenetianMask size={17} />}
        {agentsWin ? 'Agents win' : 'Imposter wins'}
      </div>
      <div className="end-reveal">
        <span>THE IMPOSTER WAS</span>
        <strong>
          {imposter?.name ?? 'A departed agent'}
          {imposter?.id === me?.id ? ' (you)' : ''}
        </strong>
        {me?.word && (
          <>
            <span>THE SECRET WORD</span>
            <strong className="text-cyan">{me.word}</strong>
          </>
        )}
      </div>
      {room.hostId === me?.id ? (
        <ActionButton onClick={() => action({ type: 'again' })}>
          One more round
          <ArrowRight size={18} />
        </ActionButton>
      ) : (
        <div className="waiting-label">
          <span className="live-dot" /> Waiting for the host to play again
        </div>
      )}
      <small className="phase-footnote">
        Same room. Fresh secrets. Another questionable alibi.
      </small>
    </div>
  );
}
export function Room() {
  const room = useGame((s) => s.room)!;
  const me = useGame((s) => s.me);
  const action = useGame((s) => s.action);
  const [leave, setLeave] = useState(false);
  const names = {
    LOBBY: 'The hideout',
    ROLE_REVEAL: 'Secret identities',
    CLUE_ROUND: 'Clue round',
    DISCUSSION: 'The discussion',
    VOTING: 'Private vote',
    VOTE_RESULTS: 'The verdict',
    FINAL_GUESS: 'Final guess',
    GAME_OVER: 'Case closed',
  };
  return (
    <>
      <div className="room-breadcrumb">
        <div>
          <span>
            <Hash size={14} />
            {room.code}
          </span>
          <i>/</i>
          <strong>{names[room.phase]}</strong>
          {room.round > 0 && <span className="round-badge">ROUND {room.round}</span>}
        </div>
        <button className="text-button" onClick={() => setLeave(true)}>
          <LogOut size={14} />
          Leave room
        </button>
      </div>
      {room.phase === 'LOBBY' ? (
        <Lobby room={room} />
      ) : (
        <div className="room-layout game-layout">
          <div className="room-main">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${room.gameId}-${room.phase}-${room.round}-${room.revote}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {room.phase === 'ROLE_REVEAL' ? (
                  <Reveal room={room} />
                ) : room.phase === 'CLUE_ROUND' ? (
                  <ClueRound room={room} />
                ) : room.phase === 'DISCUSSION' ? (
                  <Discussion room={room} />
                ) : room.phase === 'VOTING' ? (
                  <Voting room={room} />
                ) : room.phase === 'VOTE_RESULTS' ? (
                  <Results room={room} />
                ) : room.phase === 'FINAL_GUESS' ? (
                  <FinalGuess room={room} />
                ) : (
                  <GameOver room={room} />
                )}
              </motion.div>
            </AnimatePresence>
            {!['ROLE_REVEAL', 'GAME_OVER'].includes(room.phase) && <ClueHistory room={room} />}
          </div>
          <aside>
            {!['ROLE_REVEAL', 'GAME_OVER'].includes(room.phase) && (
              <SecretCard compact key={room.gameId} />
            )}
            <Roster room={room} />
            {me &&
              !room.players.find((p) => p.id === me.id)?.active &&
              room.phase !== 'GAME_OVER' && (
                <div className="side-note">
                  <span>YOUR COVER IS BLOWN</span>
                  <p>You’re spectating. Stay for the verdict and the next round.</p>
                </div>
              )}
          </aside>
        </div>
      )}
      {leave && (
        <Modal title="Going off the grid?" onClose={() => setLeave(false)}>
          <p className="modal-description">
            {room.phase === 'LOBBY' || room.phase === 'GAME_OVER'
              ? 'You can join again while the room is in the lobby.'
              : 'Leaving permanently removes you from this game. Your crew can keep playing.'}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setLeave(false)}>
              Stay suspicious
            </Button>
            <Button variant="danger" onClick={() => action({ type: 'leave' })}>
              Leave room
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
