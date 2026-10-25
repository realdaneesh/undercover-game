import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { ArrowUpRight, CircleHelp, LoaderCircle, Radio, X, WifiOff } from 'lucide-react';
import { Brand } from './components/Brand';
import { Modal } from './components/UI';
import { useGame } from './store/game';
import { Landing } from './pages/Landing';
import { Room } from './pages/Room';

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="A quick briefing." onClose={onClose}>
      <ol className="rules-list">
        <li>
          <strong>Know your secret.</strong> All agents receive the same word. One Imposter receives
          no word.
        </li>
        <li>
          <strong>Make your clue count.</strong> Take turns submitting a short clue. Don’t use the
          secret word itself. A missed turn is skipped.
        </li>
        <li>
          <strong>Talk, then point fingers.</strong> Discuss in person or on your group call. The
          host can open voting early.
        </li>
        <li>
          <strong>Keep your vote private.</strong> Vote for another active player. A tie gets one
          revote among tied suspects. Two ties mean nobody leaves.
        </li>
        <li>
          <strong>Catch them before it’s too late.</strong> A regular elimination starts another
          round. If only two active players remain, the Imposter wins.
        </li>
        <li>
          <strong>Beware the last word.</strong> An eliminated Imposter gets one guess. Correct
          means an Imposter win; incorrect or timed out means an agent win.
        </li>
      </ol>
      <p className="rules-note">
        Refreshing restores your seat. You have 60 seconds to reconnect before your departure
        becomes permanent. Multiple tabs in the same browser share one player session.
      </p>
    </Modal>
  );
}
export function App() {
  const room = useGame((s) => s.room);
  const me = useGame((s) => s.me);
  const connection = useGame((s) => s.connection);
  const restoring = useGame((s) => s.restoring);
  const error = useGame((s) => s.error);
  const [rules, setRules] = useState(false);
  const connected = connection === 'connected';
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <header className="site-header">
          <a
            href="/"
            className="brand-link"
            onClick={(e) => {
              if (room) e.preventDefault();
            }}
            aria-label="UNDERCOVER home"
          >
            <Brand />
          </a>
          <nav>
            <span
              className={`connection-badge ${connected ? 'connected' : ''}`}
              role="status"
              title={connected ? 'Connected to game server' : 'Connecting to game server'}
            >
              <span className="status-dot" />
              {connected
                ? 'ALL SYSTEMS GO'
                : connection === 'configuration'
                  ? 'SERVER NOT CONFIGURED'
                  : 'CONNECTING'}
            </span>
            <button className="nav-rules" onClick={() => setRules(true)}>
              <CircleHelp size={16} />
              <span>How to play</span>
              <ArrowUpRight size={14} />
            </button>
          </nav>
        </header>
        {!connected && (
          <div className="connection-banner" role="status">
            {connection === 'configuration' ? (
              <WifiOff size={18} />
            ) : (
              <LoaderCircle className="spin" size={18} />
            )}
            <div>
              <strong>
                {connection === 'configuration'
                  ? 'The game server needs an address.'
                  : room
                    ? 'Reconnecting to your crew…'
                    : 'Connecting to the hideout…'}
              </strong>
              <span>
                {connection === 'configuration'
                  ? 'Set the frontend environment variable VITE_SERVER_URL and rebuild.'
                  : 'The server may be waking up. This can take about a minute; we’ll connect automatically.'}
              </span>
            </div>
          </div>
        )}
        <AnimatePresence>
          {error && (
            <motion.div
              className="error-banner"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
            >
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => useGame.getState().clearError()}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <main>
          {restoring && !room ? (
            <div className="restore-screen">
              <LoaderCircle className="spin" size={32} />
              <h1>Saving your seat.</h1>
              <p>Reconnecting to your room and restoring your assignment…</p>
            </div>
          ) : room && me ? (
            <Room />
          ) : (
            <Landing />
          )}
        </main>
        <footer className="site-footer">
          <div className="footer-brand">
            UNDERCOVER<span>✦</span>
            <small>THE TRUTH IS OVERRATED.</small>
          </div>
          <p>Made for good company & questionable stories.</p>
          <span className="footer-status">
            <Radio size={13} /> A REAL-TIME SOCIAL DEDUCTION GAME
          </span>
        </footer>
        {rules && <Rules onClose={() => setRules(false)} />}
      </div>
    </MotionConfig>
  );
}
