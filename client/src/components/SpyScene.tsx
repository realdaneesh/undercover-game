import { motion } from 'framer-motion';
import { Fingerprint, ScanLine, Sparkles } from 'lucide-react';
import { Mark } from './Brand';
export function SpyScene() {
  return (
    <div className="spy-scene" aria-hidden="true">
      <div className="orbital orbital-one" />
      <div className="orbital orbital-two" />
      <span className="orbit-dot dot-one" />
      <span className="orbit-dot dot-two" />
      <span className="scene-cross cross-one">+</span>
      <span className="scene-cross cross-two">+</span>
      <div className="scene-caption">
        <span className="status-dot" /> TOP SECRET / EYES ONLY
      </div>
      <motion.div
        className="dossier-card dossier-back"
        animate={{ y: [0, -8, 0], rotate: [13, 15, 13] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="card-topline">
          <Fingerprint size={20} />
          <span>IDENTITY UNKNOWN</span>
        </div>
        <div className="dossier-lines">
          <i />
          <i />
          <i />
        </div>
        <div className="classified">CLASSIFIED</div>
      </motion.div>
      <motion.div
        className="dossier-card dossier-front"
        animate={{ y: [0, 8, 0], rotate: [-9, -7, -9] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="card-topline">
          <span>AGENT NO. 001</span>
          <ScanLine size={18} />
        </div>
        <div className="agent-portrait">
          <div className="portrait-glow" />
          <div className="spy-hat" />
          <div className="spy-head">
            <Mark />
          </div>
          <div className="spy-body">
            <i />
          </div>
          <Sparkles className="portrait-spark" size={24} />
        </div>
        <div className="dossier-bottom">
          <div>
            <small>YOUR ASSIGNMENT</small>
            <strong>Blend in.</strong>
          </div>
          <span className="barcode">▥▥▥▥▥</span>
        </div>
      </motion.div>
      <motion.div
        className="suspicion-bubble"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <span>👀</span>
        <div>
          <strong>Someone is lying.</strong>
          <small>It could be your best friend.</small>
        </div>
      </motion.div>
      <div className="scene-coordinate">28° 36′ N &nbsp; / &nbsp; TRUST LEVEL: 0%</div>
    </div>
  );
}
