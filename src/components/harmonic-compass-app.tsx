"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Copy,
  Drum,
  Gauge,
  Guitar,
  Headphones,
  Library,
  ListMusic,
  Lock,
  Menu,
  Mic2,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ChordPreviewPlayer,
  MicrophoneChordListener,
  ResponsiveBand,
  type ChordPreviewPattern,
  type ListeningState,
} from "@/audio";
import {
  analyzeFretShape,
  createGuitarVoicing,
  formatChord,
  getChordColorVariants,
  getGuitarVoicing,
  getGuitarVoicings,
  getSuggestions,
  GUITAR_TUNINGS,
  guitarDiagramWindow,
  type GuitarVoicing,
  type GuitarTuningId,
  SHOWCASE_PROGRESSION,
} from "@/music";
import {
  addVersion,
  ensureSeeded,
  getDatabase,
  importLibrary,
  saveSong,
  seedSongIds,
} from "@/storage";
import type { AssistanceLevel, ChordSymbol, EmotionalIntent, SongDocument } from "@/types/music";

type Space = "play" | "build" | "grow" | "library";
type InputMode = "idle" | "listening" | "demo" | "manual";

interface ProgressionChord {
  id: string;
  name: string;
  numeral: string;
  beats: number;
  color?: "borrowed";
  voicing?: GuitarVoicing;
  tuning?: GuitarTuningId;
  capo?: number;
}

interface Suggestion {
  chord: string;
  numeral: string;
  bearing: string;
  purpose: string;
  detail: string;
  confidence: number;
}

function createPreviewPlayer(onPreviewState?: (active: boolean) => void): ChordPreviewPlayer {
  return new ChordPreviewPlayer((active) => {
    window.dispatchEvent(new CustomEvent("harmonic-compass-preview", { detail: active }));
    onPreviewState?.(active);
  });
}

const demoProgression: ProgressionChord[] = [
  { id: "c1", name: "C", numeral: "I", beats: 4 },
  { id: "c2", name: "G", numeral: "V", beats: 4 },
  { id: "c3", name: "Am", numeral: "vi", beats: 4 },
  { id: "c4", name: "F", numeral: "IV", beats: 4 },
  { id: "c5", name: "Fm", numeral: "iv", beats: 4, color: "borrowed" },
  { id: "c6", name: "C", numeral: "I", beats: 8 },
];

const chordMap: Record<string, Suggestion[]> = {
  C: [
    {
      chord: "G",
      numeral: "V",
      bearing: "TENSION",
      purpose: "Create momentum",
      detail: "Strong pull away from home",
      confidence: 0.94,
    },
    {
      chord: "F",
      numeral: "IV",
      bearing: "LIFT",
      purpose: "Open the sound",
      detail: "A warm, familiar expansion",
      confidence: 0.89,
    },
    {
      chord: "Am",
      numeral: "vi",
      bearing: "SHADOW",
      purpose: "Turn inward",
      detail: "Keeps the notes close, changes the mood",
      confidence: 0.84,
    },
    {
      chord: "Em",
      numeral: "iii",
      bearing: "FLOW",
      purpose: "Continue gently",
      detail: "Smoothest voice leading",
      confidence: 0.72,
    },
    {
      chord: "Fm",
      numeral: "iv",
      bearing: "SURPRISE",
      purpose: "Add a bittersweet turn",
      detail: "Borrowed from C minor",
      confidence: 0.63,
    },
    {
      chord: "C",
      numeral: "I",
      bearing: "RESOLVE",
      purpose: "Stay home",
      detail: "Rest without changing direction",
      confidence: 0.79,
    },
  ],
  G: [
    {
      chord: "C",
      numeral: "I",
      bearing: "RESOLVE",
      purpose: "Come home",
      detail: "The strongest release",
      confidence: 0.97,
    },
    {
      chord: "Am",
      numeral: "vi",
      bearing: "SHADOW",
      purpose: "Soften the landing",
      detail: "A reflective detour",
      confidence: 0.87,
    },
    {
      chord: "Em",
      numeral: "iii",
      bearing: "FLOW",
      purpose: "Keep moving",
      detail: "Shared tones make this effortless",
      confidence: 0.78,
    },
    {
      chord: "F",
      numeral: "IV",
      bearing: "LIFT",
      purpose: "Open up",
      detail: "Broad and familiar",
      confidence: 0.74,
    },
    {
      chord: "D7",
      numeral: "V/V",
      bearing: "SURPRISE",
      purpose: "Push brighter",
      detail: "A secondary dominant",
      confidence: 0.62,
    },
    {
      chord: "G",
      numeral: "V",
      bearing: "TENSION",
      purpose: "Hold the tension",
      detail: "Delay the answer",
      confidence: 0.69,
    },
  ],
  Am: [
    {
      chord: "F",
      numeral: "IV",
      bearing: "LIFT",
      purpose: "Find some light",
      detail: "Opens without losing intimacy",
      confidence: 0.93,
    },
    {
      chord: "G",
      numeral: "V",
      bearing: "FLOW",
      purpose: "Continue the motion",
      detail: "A natural step downward",
      confidence: 0.88,
    },
    {
      chord: "C",
      numeral: "I",
      bearing: "RESOLVE",
      purpose: "Return home",
      detail: "Warm major release",
      confidence: 0.86,
    },
    {
      chord: "Dm",
      numeral: "ii",
      bearing: "SHADOW",
      purpose: "Go deeper",
      detail: "Leans further into minor",
      confidence: 0.81,
    },
    {
      chord: "E7",
      numeral: "V/vi",
      bearing: "TENSION",
      purpose: "Intensify",
      detail: "Pulls strongly back to A minor",
      confidence: 0.75,
    },
    {
      chord: "Fm",
      numeral: "iv",
      bearing: "SURPRISE",
      purpose: "Change the color",
      detail: "Unexpected chromatic movement",
      confidence: 0.58,
    },
  ],
  F: [
    {
      chord: "C",
      numeral: "I",
      bearing: "RESOLVE",
      purpose: "Come home",
      detail: "Clear, settled release",
      confidence: 0.94,
    },
    {
      chord: "G",
      numeral: "V",
      bearing: "TENSION",
      purpose: "Build tension",
      detail: "Points firmly toward home",
      confidence: 0.9,
    },
    {
      chord: "Am",
      numeral: "vi",
      bearing: "SHADOW",
      purpose: "Turn inward",
      detail: "Gentle and connected",
      confidence: 0.82,
    },
    {
      chord: "Dm",
      numeral: "ii",
      bearing: "FLOW",
      purpose: "Continue softly",
      detail: "Two shared notes",
      confidence: 0.77,
    },
    {
      chord: "Fm",
      numeral: "iv",
      bearing: "SURPRISE",
      purpose: "Become bittersweet",
      detail: "The borrowed minor iv",
      confidence: 0.71,
    },
    {
      chord: "C/E",
      numeral: "I⁶",
      bearing: "LIFT",
      purpose: "Rise smoothly",
      detail: "Bass steps upward",
      confidence: 0.66,
    },
  ],
  Fm: [
    {
      chord: "C",
      numeral: "I",
      bearing: "RESOLVE",
      purpose: "Release the ache",
      detail: "The classic minor iv resolution",
      confidence: 0.96,
    },
    {
      chord: "G",
      numeral: "V",
      bearing: "TENSION",
      purpose: "Hold the drama",
      detail: "Delays the homecoming",
      confidence: 0.83,
    },
    {
      chord: "Ab",
      numeral: "♭VI",
      bearing: "SHADOW",
      purpose: "Go cinematic",
      detail: "Deepens the borrowed color",
      confidence: 0.76,
    },
    {
      chord: "Dm7♭5",
      numeral: "iiø",
      bearing: "SURPRISE",
      purpose: "Turn mysterious",
      detail: "A darker predominant",
      confidence: 0.61,
    },
    {
      chord: "Am",
      numeral: "vi",
      bearing: "FLOW",
      purpose: "Keep it tender",
      detail: "Chromatic inner voice",
      confidence: 0.68,
    },
    {
      chord: "F",
      numeral: "IV",
      bearing: "LIFT",
      purpose: "Brighten again",
      detail: "Restore the major color",
      confidence: 0.79,
    },
  ],
};

const defaultSuggestions = chordMap.C;
const pitchClassByName: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function parseChordName(name: string): ChordSymbol {
  const [symbol, bassName] = name.replaceAll("♭", "b").replaceAll("♯", "#").split("/");
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(symbol ?? "C");
  const rootName = match?.[1] ?? "C";
  const suffix = (match?.[2] ?? "").replaceAll("(", "").replaceAll(")", "");
  const quality: ChordSymbol["quality"] = suffix.includes("m7b5")
    ? "halfDiminished"
    : suffix.includes("maj9")
      ? "major9"
      : suffix.includes("m9")
        ? "minor9"
        : suffix.includes("9")
          ? "dominant9"
          : suffix.includes("maj7")
            ? "major7"
            : suffix.includes("m7")
              ? "minor7"
              : suffix.includes("add9")
                ? suffix.startsWith("m")
                  ? "minorAdd9"
                  : "add9"
                : suffix.includes("m6")
                  ? "minor6"
                  : suffix === "6"
                    ? "major6"
                    : suffix.includes("dim")
                      ? "diminished"
                      : suffix.includes("aug") || suffix === "+"
                        ? "augmented"
                        : suffix === "5"
                          ? "power"
                          : suffix.includes("sus2")
                            ? "sus2"
                            : suffix.includes("sus4") || suffix === "sus"
                              ? "sus4"
                              : suffix === "m" || suffix.startsWith("m")
                                ? "minor"
                                : "major";
  const root = pitchClassByName[rootName] ?? 0;
  const bass = bassName ? pitchClassByName[bassName] : undefined;
  return bass === undefined ? { root, quality } : { root, quality, bass };
}
function cloneProgression(progression: ProgressionChord[]): ProgressionChord[] {
  return progression.map((chord) => ({ ...chord }));
}

function buildSectionsForProgression(progression: ProgressionChord[]): BuildSection[] {
  return [
    {
      id: "session-idea",
      name: "Your idea",
      color: "sage",
      chords: cloneProgression(progression),
    },
  ];
}

const emotionalIntents: { id: EmotionalIntent; label: string; icon: string }[] = [
  { id: "hopeful", label: "More hopeful", icon: "↗" },
  { id: "intimate", label: "More intimate", icon: "○" },
  { id: "energetic", label: "More energy", icon: "⌁" },
  { id: "tense", label: "More tense", icon: "△" },
  { id: "mysterious", label: "Mysterious", icon: "◇" },
  { id: "melancholic", label: "Melancholic", icon: "↓" },
  { id: "triumphant", label: "Triumphant", icon: "↑" },
  { id: "unresolved", label: "Unresolved", icon: "…" },
  { id: "home", label: "Back home", icon: "⌂" },
  { id: "surprise", label: "Surprise me", icon: "✦" },
];

const routes: Record<EmotionalIntent, { label: string; note: string; chords: string[] }[]> = {
  hopeful: [
    { label: "Direct", note: "Clear and warm", chords: ["C", "F", "G", "C"] },
    { label: "Build", note: "Earn the lift", chords: ["Am", "F", "Dm", "G"] },
    { label: "Twist", note: "Light after shadow", chords: ["F", "Fm", "C"] },
  ],
  intimate: [
    { label: "Direct", note: "Keep it close", chords: ["Am", "Em", "F"] },
    { label: "Build", note: "Quiet descent", chords: ["C", "G/B", "Am", "F"] },
    { label: "Twist", note: "Soft borrowed color", chords: ["Dm", "Fm", "C"] },
  ],
  energetic: [
    { label: "Direct", note: "Forward motion", chords: ["C", "G", "Am", "F"] },
    { label: "Build", note: "Bigger push", chords: ["Am", "F", "C", "G"] },
    { label: "Twist", note: "Bright dominant", chords: ["C", "E7", "Am", "G"] },
  ],
  tense: [
    { label: "Direct", note: "Hold the pull", chords: ["C", "Dm", "G"] },
    { label: "Build", note: "Climb gradually", chords: ["F", "Dm", "D7", "G"] },
    { label: "Twist", note: "Chromatic pressure", chords: ["C", "Fm", "G"] },
  ],
  mysterious: [
    { label: "Direct", note: "Dark color", chords: ["C", "Fm", "Ab"] },
    { label: "Build", note: "Avoid home", chords: ["Am", "Dm", "Fm"] },
    { label: "Twist", note: "A cinematic door", chords: ["C", "Eb", "Fm"] },
  ],
  melancholic: [
    { label: "Direct", note: "Gentle ache", chords: ["C", "Am", "F"] },
    { label: "Build", note: "Longer descent", chords: ["C", "G/B", "Am", "Em"] },
    { label: "Twist", note: "Bittersweet", chords: ["F", "Fm", "C"] },
  ],
  triumphant: [
    { label: "Direct", note: "Open arrival", chords: ["Am", "F", "G", "C"] },
    { label: "Build", note: "Stronger rise", chords: ["Am", "Dm", "G", "C"] },
    { label: "Twist", note: "Dramatic turn", chords: ["Am", "E7", "F", "G"] },
  ],
  unresolved: [
    { label: "Direct", note: "End on the question", chords: ["C", "F", "G"] },
    { label: "Build", note: "Suspended", chords: ["Am", "F", "Gsus4"] },
    { label: "Twist", note: "Leave the door open", chords: ["C", "Fm", "G"] },
  ],
  home: [
    { label: "Direct", note: "Strongest return", chords: ["G", "C"] },
    { label: "Build", note: "Prepare the landing", chords: ["Dm", "G", "C"] },
    { label: "Twist", note: "Bittersweet return", chords: ["F", "Fm", "C"] },
  ],
  surprise: [
    { label: "Direct", note: "Borrow the shadow", chords: ["C", "Fm", "C"] },
    { label: "Build", note: "Side-step", chords: ["C", "E7", "Am"] },
    { label: "Twist", note: "Open a new world", chords: ["C", "Eb", "Ab"] },
  ],
};

const navItems: { id: Space; label: string; icon: typeof Compass }[] = [
  { id: "play", label: "Play", icon: Compass },
  { id: "build", label: "Build", icon: ListMusic },
  { id: "grow", label: "Grow", icon: BookOpen },
  { id: "library", label: "Library", icon: Library },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand-lockup ${compact ? "brand-lockup--compact" : ""}`}
      role="img"
      aria-label="Harmonic Compass"
    >
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand-name">
          Harmonic <strong>Compass</strong>
        </span>
      )}
    </div>
  );
}

function Onboarding({
  onListen,
  onDemo,
  onManual,
}: {
  onListen: () => void;
  onDemo: () => void;
  onManual: () => void;
}) {
  return (
    <main className="entry-screen">
      <header className="entry-header">
        <BrandMark />
        <button className="text-button" onClick={onDemo}>
          Explore the demo <ArrowRight size={15} />
        </button>
      </header>
      <section className="entry-hero" aria-labelledby="entry-heading">
        <div className="entry-signal" aria-hidden="true">
          <div className="entry-signal__orbit entry-signal__orbit--outer" />
          <div className="entry-signal__orbit entry-signal__orbit--inner" />
          <div className="entry-signal__needle" />
          <div className="entry-signal__core">
            <Guitar size={42} strokeWidth={1.35} />
          </div>
          {["RESOLVE", "LIFT", "TENSION", "SHADOW", "SURPRISE", "FLOW"].map((label, i) => (
            <span key={label} className={`entry-signal__label entry-signal__label--${i + 1}`}>
              {label}
            </span>
          ))}
        </div>
        <div className="entry-copy">
          <p className="eyebrow">A musical navigation system for guitarists</p>
          <h1 id="entry-heading">
            Never feel lost
            <br />
            after playing a chord.
          </h1>
          <p className="entry-description">
            Play one clean chord. We’ll name it, show you how it feels, and suggest one next move.
          </p>
          <div className="entry-actions">
            <button className="primary-button primary-button--large" onClick={onListen}>
              <Mic2 size={19} /> Start listening
            </button>
            <button className="secondary-button secondary-button--large" onClick={onDemo}>
              <Play size={18} fill="currentColor" /> Play guided showcase
            </button>
            <button className="text-button entry-manual-button" onClick={onManual}>
              Enter chords manually <ArrowRight size={15} />
            </button>
          </div>
          <p className="privacy-note">
            <Lock size={12} /> Your audio stays on this device
          </p>
        </div>
      </section>
      <footer className="entry-footer">
        <span>Play</span>
        <i />
        <span>Recognize</span>
        <i />
        <span>Navigate</span>
        <i />
        <span>Create</span>
      </footer>
    </main>
  );
}

function AppNavigation({
  activeSpace,
  setActiveSpace,
  mobileOpen,
  setMobileOpen,
  onSettings,
}: {
  activeSpace: Space;
  setActiveSpace: (space: Space) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  onSettings: () => void;
}) {
  return (
    <>
      <aside className={`app-rail ${mobileOpen ? "app-rail--open" : ""}`}>
        <div className="rail-brand">
          <BrandMark compact />
        </div>
        <nav className="rail-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`rail-nav__item ${activeSpace === id ? "is-active" : ""}`}
              aria-current={activeSpace === id ? "page" : undefined}
              onClick={() => {
                setActiveSpace(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={21} strokeWidth={activeSpace === id ? 2.2 : 1.6} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="rail-settings" aria-label="Open settings" onClick={onSettings}>
          <Settings2 size={20} />
        </button>
      </aside>
      <nav className="mobile-nav" aria-label="Primary navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activeSpace === id ? "is-active" : ""}
            aria-current={activeSpace === id ? "page" : undefined}
            onClick={() => setActiveSpace(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button aria-label="Open settings" onClick={onSettings}>
          <Settings2 size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </>
  );
}

function WorkspaceHeader({
  title,
  subtitle,
  onMenu,
  onMentor,
  onProfile,
}: {
  title: string;
  subtitle?: string;
  onMenu: () => void;
  onMentor: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="workspace-header">
      <button
        className="icon-button workspace-header__menu"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu size={21} />
      </button>
      <div className="workspace-title">
        <span>{title}</span>
        {subtitle && <small>{subtitle}</small>}
      </div>
      <div className="workspace-header__actions">
        <button className="mentor-button" onClick={onMentor}>
          <Sparkles size={16} />
          <span>Ask Compass</span>
        </button>
        <button className="avatar-button" aria-label="Open player profile" onClick={onProfile}>
          T
        </button>
      </div>
    </header>
  );
}

function ChordDiagram({
  chord,
  voicing,
  tuningId = "standard",
  capo = 0,
  compact = false,
}: {
  chord: string;
  voicing?: GuitarVoicing;
  tuningId?: GuitarTuningId;
  capo?: number;
  compact?: boolean;
}) {
  const resolved = voicing ?? getGuitarVoicing(chord, { tuning: tuningId, capo });
  const { firstFret, fretCount } = guitarDiagramWindow(resolved);
  const stringXs = [12, 26, 40, 54, 68, 82];
  const fretHeight = 16;
  const top = 22;
  const barreGroups = new Map<string, number[]>();
  resolved.frets.forEach((fret, stringIndex) => {
    const finger = resolved.fingers[stringIndex];
    if (fret <= 0 || finger <= 0) return;
    const key = `${fret}-${finger}`;
    barreGroups.set(key, [...(barreGroups.get(key) ?? []), stringIndex]);
  });
  const barres = [...barreGroups.entries()].filter(([, strings]) => strings.length >= 2);

  return (
    <div
      className={`chord-diagram ${compact ? "chord-diagram--compact" : ""}`}
      aria-label={`${chord} guitar chord diagram, ${resolved.name}`}
    >
      <svg viewBox="0 0 94 110" aria-hidden="true">
        {resolved.frets.map((fret, stringIndex) => (
          <text key={`status-${stringIndex}`} x={stringXs[stringIndex]} y="10" textAnchor="middle">
            {fret < 0 ? "×" : fret === 0 ? "○" : ""}
          </text>
        ))}
        {stringXs.map((x) => (
          <line key={`string-${x}`} x1={x} y1={top} x2={x} y2={top + fretCount * fretHeight} />
        ))}
        {Array.from({ length: fretCount + 1 }).map((_, index) => (
          <line
            key={`fret-${index}`}
            className={index === 0 && firstFret === 1 ? "is-nut" : ""}
            x1={stringXs[0]}
            y1={top + index * fretHeight}
            x2={stringXs.at(-1)}
            y2={top + index * fretHeight}
          />
        ))}
        {barres.map(([key, strings]) => {
          const fret = Number(key.split("-")[0]);
          const relativeFret = fret - firstFret;
          const y = top + (relativeFret + 0.5) * fretHeight;
          return (
            <line
              key={`barre-${key}`}
              className="is-barre"
              x1={stringXs[Math.min(...strings)]}
              y1={y}
              x2={stringXs[Math.max(...strings)]}
              y2={y}
            />
          );
        })}
        {resolved.frets.map((fret, stringIndex) => {
          if (fret <= 0) return null;
          const relativeFret = fret - firstFret;
          const y = top + (relativeFret + 0.5) * fretHeight;
          return (
            <g key={`finger-${stringIndex}`}>
              <circle cx={stringXs[stringIndex]} cy={y} r="5.5" />
              <text
                className="finger-number"
                x={stringXs[stringIndex]}
                y={y + 2.2}
                textAnchor="middle"
              >
                {resolved.fingers[stringIndex]}
              </text>
            </g>
          );
        })}
      </svg>
      {firstFret > 1 && <span className="chord-diagram__position">{firstFret}fr</span>}
      <small>{resolved.name}</small>
      {!compact && (
        <span className="chord-diagram__stats">
          {resolved.openStrings} open · {resolved.difficulty}/5 difficulty
        </span>
      )}
      {capo > 0 && <span className="chord-diagram__capo">Capo {capo}</span>}
    </div>
  );
}
function ShapeFinder({
  tuningId,
  capo,
  setTuningId,
  setCapo,
  onUseChord,
  onClose,
}: {
  tuningId: GuitarTuningId;
  capo: number;
  setTuningId: (tuning: GuitarTuningId) => void;
  setCapo: (capo: number) => void;
  onUseChord: (chord: string, frets: readonly number[]) => void;
  onClose: () => void;
}) {
  const [frets, setFrets] = useState<number[]>([-1, -1, -1, -1, -1, -1]);
  const matches = analyzeFretShape(frets, tuningId, capo);
  const strings = ["E", "A", "D", "G", "B", "e"];
  const choices = [-1, 0, 1, 2, 3, 4, 5];

  return (
    <section className="shape-finder" aria-labelledby="shape-finder-title">
      <header className="shape-finder__header">
        <div>
          <span className="section-kicker">SHAPE FINDER</span>
          <h2 id="shape-finder-title">What chord is this shape?</h2>
          <p>Tap one fret on each string. We’ll show the most likely names and bass note.</p>
        </div>
        <button className="icon-button" aria-label="Close shape finder" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="shape-finder__setup">
        <label>
          <span>Tuning</span>
          <select
            value={tuningId}
            onChange={(event) => setTuningId(event.target.value as GuitarTuningId)}
          >
            {GUITAR_TUNINGS.map((tuning) => (
              <option key={tuning.id} value={tuning.id}>
                {tuning.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Capo</span>
          <input
            type="number"
            min={0}
            max={12}
            value={capo}
            onChange={(event) =>
              setCapo(Math.max(0, Math.min(12, Number(event.target.value) || 0)))
            }
          />
        </label>
        <button className="text-button" onClick={() => setFrets([-1, -1, -1, -1, -1, -1])}>
          Clear
        </button>
      </div>
      <div className="shape-finder__grid" role="group" aria-label="Guitar fret selector">
        {strings.map((stringName, stringIndex) => (
          <div className="shape-finder__row" key={stringName}>
            <span>{stringName}</span>
            {choices.map((fret) => (
              <button
                key={fret}
                className={frets[stringIndex] === fret ? "is-active" : ""}
                aria-pressed={frets[stringIndex] === fret}
                aria-label={`${stringName} string ${fret < 0 ? "muted" : fret === 0 ? "open" : `fret ${fret}`}`}
                onClick={() =>
                  setFrets((current) =>
                    current.map((value, index) => (index === stringIndex ? fret : value)),
                  )
                }
              >
                {fret < 0 ? "×" : fret === 0 ? "○" : fret}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="shape-finder__matches" aria-live="polite">
        {matches.length === 0 ? (
          <p className="shape-finder__empty">Choose at least two notes to reveal a chord.</p>
        ) : (
          matches.map((match) => (
            <button
              key={match.chord}
              className="shape-match"
              onClick={() => onUseChord(match.chord, frets)}
            >
              <span>
                <strong>{match.chord}</strong>
                <small>{match.detail}</small>
              </span>
              <em>{Math.round(match.confidence * 100)}%</em>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
function CompassNode({
  suggestion,
  index,
  selected,
  onSelect,
  assistance,
}: {
  suggestion: Suggestion;
  index: number;
  selected: boolean;
  onSelect: () => void;
  assistance: AssistanceLevel;
}) {
  return (
    <button
      className={`compass-node compass-node--${index + 1} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-label={`${suggestion.chord}: ${suggestion.purpose}`}
      aria-pressed={selected}
    >
      <span className="compass-node__bearing">{suggestion.bearing}</span>
      <span className="compass-node__chord">{suggestion.chord}</span>
      {assistance !== "beginner" && (
        <span className="compass-node__numeral">{suggestion.numeral}</span>
      )}
      <span className="compass-node__purpose">{suggestion.purpose}</span>
      <span className="compass-node__signal" style={{ width: `${suggestion.confidence * 100}%` }} />
    </button>
  );
}

function HarmonicCompass({
  currentChord,
  inputMode,
  suggestions,
  selectedSuggestion,
  setSelectedSuggestion,
  assistance,
  tuningId,
  capo,
  previousVoicing,
  onUseVoicing,
}: {
  currentChord: ProgressionChord | null;
  inputMode: InputMode;
  suggestions: Suggestion[];
  selectedSuggestion: number | null;
  setSelectedSuggestion: (index: number | null) => void;
  assistance: AssistanceLevel;
  tuningId: GuitarTuningId;
  capo: number;
  previousVoicing?: GuitarVoicing;
  onUseVoicing: (chord: string, voicing: GuitarVoicing) => void;
}) {
  const activeSuggestion = selectedSuggestion === null ? null : suggestions[selectedSuggestion];
  const previewRef = useRef<ChordPreviewPlayer | null>(null);
  const [previewPattern, setPreviewPattern] = useState<ChordPreviewPattern>("strum");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [voicingIndex, setVoicingIndex] = useState(0);
  const [exploredChord, setExploredChord] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [favorites, setFavorites] = useState<GuitarVoicing[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("harmonic-compass-voicing-favorites");
      return stored ? (JSON.parse(stored) as GuitarVoicing[]) : [];
    } catch {
      return [];
    }
  });
  const activeChord = exploredChord ?? activeSuggestion?.chord ?? null;
  const voicings = activeChord
    ? getGuitarVoicings(activeChord, {
        tuning: tuningId,
        capo,
        previous: previousVoicing,
        limit: 6,
      })
    : [];
  const activeVoicing = voicings[voicingIndex] ?? voicings[0];
  const displayVoicingIndex = activeVoicing
    ? Math.max(
        0,
        voicings.findIndex((voicing) => voicing.id === activeVoicing.id),
      )
    : 0;
  const savedForChord = activeChord
    ? favorites.filter((voicing) => voicing.chord === activeChord)
    : [];
  const comparisonVoicing = savedForChord.find((voicing) => voicing.id !== activeVoicing?.id);
  const variants = activeChord ? getChordColorVariants(activeChord) : [];

  useEffect(() => {
    window.localStorage.setItem("harmonic-compass-voicing-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(
    () => () => {
      void previewRef.current?.stop();
    },
    [],
  );

  const previewChord = async () => {
    if (!activeChord || !activeVoicing) return;
    previewRef.current ??= createPreviewPlayer(setIsPreviewing);
    await previewRef.current.previewGuitarChord(activeChord, {
      pattern: previewPattern,
      voicing: activeVoicing,
      tuning: tuningId,
      capo,
    });
  };

  const toggleFavorite = () => {
    if (!activeVoicing) return;
    setFavorites((current) =>
      current.some((voicing) => voicing.id === activeVoicing.id)
        ? current.filter((voicing) => voicing.id !== activeVoicing.id)
        : [activeVoicing, ...current].slice(0, 24),
    );
  };

  return (
    <div className="compass-stage">
      <div className="compass-stage__axis" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="compass-orbit compass-orbit--outer" aria-hidden="true" />
      <div className="compass-orbit compass-orbit--inner" aria-hidden="true" />
      <div className="compass-route-lines" aria-hidden="true">
        {suggestions.map((suggestion, index) => (
          <span
            key={`${suggestion.chord}-${index}`}
            className={`compass-route compass-route--${index + 1} ${selectedSuggestion === index ? "is-active" : ""} ${
              suggestion.bearing === "SURPRISE" ? "is-borrowed" : ""
            }`}
          />
        ))}
      </div>
      {suggestions.map((suggestion, index) => (
        <CompassNode
          key={`${suggestion.chord}-${index}`}
          suggestion={suggestion}
          index={index}
          selected={selectedSuggestion === index}
          onSelect={() => {
            setVoicingIndex(0);
            setExploredChord(null);
            setCompareOpen(false);
            setSelectedSuggestion(selectedSuggestion === index ? null : index);
          }}
          assistance={assistance}
        />
      ))}
      <div
        className={`current-chord ${inputMode !== "idle" ? "is-live" : ""} ${!currentChord ? "current-chord--waiting" : ""}`}
      >
        <span className="current-chord__status">
          <i />
          {inputMode === "demo"
            ? "DEMO SIGNAL"
            : inputMode === "manual"
              ? "MANUAL INPUT"
              : inputMode === "listening"
                ? "LISTENING"
                : "PAUSED"}
        </span>
        {currentChord ? (
          <>
            <strong>{currentChord.name}</strong>
            {assistance !== "beginner" && <em>{currentChord.numeral} · HARMONIC CENTER</em>}
            <div className="current-chord__meter" aria-label="Recognition confidence 96%">
              <span style={{ width: "96%" }} />
            </div>
            <small>96% confident</small>
          </>
        ) : (
          <>
            <strong>—</strong>
            <p>Play one clean chord and let it ring.</p>
          </>
        )}
      </div>
      {activeSuggestion && activeChord && activeVoicing && (
        <div className="suggestion-inspector" role="status">
          <div className="suggestion-inspector__diagram">
            <ChordDiagram
              chord={activeChord}
              voicing={activeVoicing}
              tuningId={tuningId}
              capo={capo}
            />
          </div>
          <div className="suggestion-inspector__copy">
            <span>{activeSuggestion.bearing}</span>
            <strong>
              {activeChord} <small>{activeSuggestion.numeral}</small>
            </strong>
            <p>{activeSuggestion.detail}</p>
          </div>
          <div className="voicing-explorer" aria-label="Voicing explorer">
            <header>
              <span className="section-kicker">VOICING EXPLORER</span>
              <strong>{voicings.length} playable shapes</strong>
            </header>
            <div className="voicing-explorer__pager">
              <button
                className="icon-button"
                aria-label="Previous voicing"
                disabled={displayVoicingIndex === 0}
                onClick={() => setVoicingIndex(Math.max(0, displayVoicingIndex - 1))}
              >
                <ArrowLeft size={14} />
              </button>
              <span>
                {displayVoicingIndex + 1} / {voicings.length} · {activeVoicing.name}
              </span>
              <button
                className="icon-button"
                aria-label="Next voicing"
                disabled={displayVoicingIndex >= voicings.length - 1}
                onClick={() =>
                  setVoicingIndex(Math.min(voicings.length - 1, displayVoicingIndex + 1))
                }
              >
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="voicing-explorer__meta">
              <span>{activeVoicing.style}</span>
              <span>{activeVoicing.difficulty}/5 difficulty</span>
              <span>{activeVoicing.openStrings} open</span>
              {activeVoicing.sharedStrings ? (
                <span>{activeVoicing.sharedStrings} shared</span>
              ) : null}
            </div>
            <div className="voicing-explorer__actions">
              <button
                className="secondary-button"
                onClick={() => onUseVoicing(activeChord, activeVoicing)}
              >
                <Guitar size={14} /> Use this shape
              </button>
              <button
                className={`icon-button ${favorites.some((voicing) => voicing.id === activeVoicing.id) ? "is-active" : ""}`}
                aria-label="Save voicing to favorites"
                aria-pressed={favorites.some((voicing) => voicing.id === activeVoicing.id)}
                onClick={toggleFavorite}
              >
                <Star size={15} fill="currentColor" />
              </button>
              {comparisonVoicing && (
                <button className="text-button" onClick={() => setCompareOpen((open) => !open)}>
                  {compareOpen ? "Hide compare" : "Compare saved"}
                </button>
              )}
            </div>
            {compareOpen && comparisonVoicing && (
              <div className="voicing-compare">
                <div>
                  <small>Current</small>
                  <ChordDiagram chord={activeChord} voicing={activeVoicing} compact />
                </div>
                <div>
                  <small>Saved</small>
                  <ChordDiagram chord={activeChord} voicing={comparisonVoicing} compact />
                </div>
              </div>
            )}
          </div>
          <div className="chord-variants">
            <span className="section-kicker">CHANGE THE COLOR</span>
            <div>
              {variants.map((variant) => (
                <button
                  key={variant.chord}
                  onClick={() => {
                    setExploredChord(variant.chord);
                    setVoicingIndex(0);
                    setCompareOpen(false);
                  }}
                >
                  <strong>{variant.chord}</strong>
                  <small>{variant.label}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="suggestion-inspector__playback">
            <div className="preview-pattern" role="group" aria-label="Chord preview pattern">
              {(["strum", "arpeggio"] as const).map((pattern) => (
                <button
                  key={pattern}
                  className={previewPattern === pattern ? "is-active" : ""}
                  aria-pressed={previewPattern === pattern}
                  onClick={() => setPreviewPattern(pattern)}
                >
                  {pattern === "strum" ? "Strum" : "Arpeggio"}
                </button>
              ))}
            </div>
            <button
              className={`preview-button ${isPreviewing ? "is-active" : ""}`}
              onClick={() => void previewChord()}
              aria-label={`Preview ${activeChord} as ${previewPattern}`}
            >
              <Volume2 size={16} /> {isPreviewing ? "Playing…" : "Hear guitar"}
            </button>
          </div>
          <button
            className="icon-button suggestion-inspector__close"
            aria-label="Close chord detail"
            onClick={() => setSelectedSuggestion(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function SessionControls({
  inputMode,
  setInputMode,
  listeningState,
  assistance,
  setAssistance,
  currentChord,
  setCurrentChordName,
}: {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  listeningState: ListeningState;
  assistance: AssistanceLevel;
  setAssistance: (level: AssistanceLevel) => void;
  currentChord: ProgressionChord | null;
  setCurrentChordName: (name: string) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  return (
    <div className="session-controls">
      <div className="signal-control">
        <button
          className={`signal-control__button ${inputMode !== "idle" ? "is-active" : ""}`}
          onClick={() => setInputMode(inputMode === "idle" ? "listening" : "idle")}
          disabled={listeningState === "requesting"}
        >
          {inputMode === "idle" || listeningState === "requesting" ? (
            <Mic2 size={17} />
          ) : (
            <Pause size={17} />
          )}
          {inputMode === "idle"
            ? "Start listening"
            : listeningState === "requesting"
              ? "Requesting microphone…"
              : "Pause"}
        </button>
        <span
          className={`signal-control__level ${inputMode !== "idle" ? "is-active" : ""}`}
          aria-hidden="true"
        >
          {[22, 42, 67, 90, 58, 35, 72, 48].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </span>
      </div>
      <div className="mode-switch" aria-label="Input mode">
        <button
          className={inputMode === "demo" ? "is-active" : ""}
          onClick={() => setInputMode("demo")}
        >
          Demo
        </button>
        <button
          className={inputMode === "manual" ? "is-active" : ""}
          onClick={() => {
            setInputMode("manual");
            setManualOpen(!manualOpen);
          }}
        >
          Manual
        </button>
      </div>
      {manualOpen && (
        <div className="manual-chord-picker">
          <span>Choose a chord</span>
          <div>
            {["C", "Dm", "Em", "F", "G", "Am", "Fm", "E7"].map((chord) => (
              <button
                key={chord}
                className={currentChord?.name === chord ? "is-active" : ""}
                onClick={() => {
                  setCurrentChordName(chord);
                  setInputMode("manual");
                  setManualOpen(false);
                }}
              >
                {chord}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="assistance-select">
        <span>VIEW</span>
        <select
          value={assistance}
          onChange={(event) => setAssistance(event.target.value as AssistanceLevel)}
        >
          <option value="beginner">Beginner</option>
          <option value="developing">Developing</option>
          <option value="advanced">Advanced</option>
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
    </div>
  );
}

function EmotionalTray({
  selectedIntent,
  setSelectedIntent,
}: {
  selectedIntent: EmotionalIntent | null;
  setSelectedIntent: (intent: EmotionalIntent | null) => void;
}) {
  const previewRef = useRef<ChordPreviewPlayer | null>(null);
  const [pinnedRoute, setPinnedRoute] = useState<string | null>(null);
  useEffect(
    () => () => {
      void previewRef.current?.stop();
    },
    [],
  );
  const previewRoute = async (chords: string[]) => {
    previewRef.current ??= createPreviewPlayer();
    await previewRef.current.previewGuitarRoute(chords, 96, "strum");
  };
  return (
    <section
      className={`emotion-tray ${selectedIntent ? "is-expanded" : ""}`}
      aria-labelledby="emotion-heading"
    >
      <div className="emotion-tray__header">
        <div>
          <span className="section-kicker">NAVIGATE BY FEELING</span>
          <h2 id="emotion-heading">Where do you want the music to go?</h2>
        </div>
        {selectedIntent && (
          <button className="text-button" onClick={() => setSelectedIntent(null)}>
            Clear route <X size={14} />
          </button>
        )}
      </div>
      <div className="emotion-list">
        {emotionalIntents.map((intent) => (
          <button
            key={intent.id}
            className={selectedIntent === intent.id ? "is-active" : ""}
            onClick={() => setSelectedIntent(selectedIntent === intent.id ? null : intent.id)}
            aria-pressed={selectedIntent === intent.id}
          >
            <span>{intent.icon}</span>
            {intent.label}
          </button>
        ))}
      </div>
      {selectedIntent && (
        <div className="route-options">
          {routes[selectedIntent].map((route, routeIndex) => (
            <article key={route.label} className="route-option">
              <div className="route-option__meta">
                <span>0{routeIndex + 1}</span>
                <div>
                  <strong>{route.label}</strong>
                  <small>{route.note}</small>
                </div>
              </div>
              <div className="route-option__chords">
                {route.chords.map((chord, index) => (
                  <span key={`${chord}-${index}`}>
                    {chord}
                    {index < route.chords.length - 1 && <ArrowRight size={12} />}
                  </span>
                ))}
              </div>
              <button
                className="icon-button"
                aria-label={`Preview ${route.label} route`}
                onClick={() => void previewRoute(route.chords)}
              >
                <Play size={15} fill="currentColor" />
              </button>
              <button
                className={`route-option__pin ${pinnedRoute === `${selectedIntent}-${route.label}` ? "is-pinned" : ""}`}
                aria-pressed={pinnedRoute === `${selectedIntent}-${route.label}`}
                onClick={() =>
                  setPinnedRoute((current) =>
                    current === `${selectedIntent}-${route.label}`
                      ? null
                      : `${selectedIntent}-${route.label}`,
                  )
                }
              >
                {pinnedRoute === `${selectedIntent}-${route.label}` ? "Pinned" : "Pin route"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TakeRibbon({
  progression,
  activeIndex,
  isPlaying,
  setIsPlaying,
  setActiveIndex,
  onAddChord,
  onOpenBuild,
}: {
  progression: ProgressionChord[];
  activeIndex: number;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
  setActiveIndex: (index: number) => void;
  onAddChord: () => void;
  onOpenBuild: () => void;
}) {
  return (
    <section className="take-ribbon" aria-label="Captured progression">
      <div className="take-ribbon__heading">
        <div>
          <span className="section-kicker">
            {progression.length ? "LIVE TAKE" : "READY TO CAPTURE"}
          </span>
          <strong>
            {progression.length ? "Your idea" : "Play a chord to start your first idea"}
          </strong>
        </div>
        <div className="take-ribbon__transport">
          <button
            className="icon-button"
            aria-label="Restart take"
            onClick={() => setActiveIndex(0)}
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="transport-button"
            aria-label={isPlaying ? "Pause take" : "Play take"}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
        </div>
      </div>
      <div className="take-ribbon__timeline">
        <div className="take-ribbon__track">
          {progression.length === 0 ? (
            <div className="take-ribbon__empty">
              Your confirmed chords will appear here as you play.
            </div>
          ) : (
            <>
              {progression.map((chord, index) => (
                <button
                  key={chord.id}
                  className={`${activeIndex === index ? "is-active" : ""} ${chord.color === "borrowed" ? "is-borrowed" : ""}`}
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{chord.numeral}</span>
                  <strong>{chord.name}</strong>
                  <small>{chord.beats} beats</small>
                </button>
              ))}
              <button className="take-ribbon__add" aria-label="Add chord" onClick={onAddChord}>
                <Plus size={18} />
              </button>
            </>
          )}
        </div>
        <div className="timeline-ticks" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => (
            <i key={index} />
          ))}
        </div>
      </div>
      <button
        className="take-ribbon__build"
        onClick={onOpenBuild}
        disabled={progression.length === 0}
      >
        Open in Build <ArrowRight size={15} />
      </button>
    </section>
  );
}

function BandControl({ progression, available }: { progression: string[]; available: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [density, setDensity] = useState<1 | 2 | 3>(2);
  const bandRef = useRef<ResponsiveBand | null>(null);

  useEffect(
    () => () => {
      void bandRef.current?.stop();
    },
    [],
  );

  const startBand = async (nextDensity: 1 | 2 | 3) => {
    const band = bandRef.current ?? new ResponsiveBand();
    bandRef.current = band;
    await band.start({
      bpm: 96,
      style: "open-road",
      density: nextDensity,
      progression: progression.length ? progression.map(parseChordName) : SHOWCASE_PROGRESSION,
    });
  };

  const toggleBand = async () => {
    if (!available) return;
    if (enabled) {
      setEnabled(false);
      await bandRef.current?.stop();
      return;
    }
    try {
      await startBand(density);
      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  };

  const changeDensity = async (value: 1 | 2 | 3) => {
    setDensity(value);
    if (enabled) await startBand(value);
  };

  return (
    <div className={`band-control ${enabled ? "is-enabled" : ""}`}>
      <div className="band-control__title">
        <span className="band-icon">
          <Drum size={17} />
        </span>
        <div>
          <strong>Responsive band</strong>
          <small>
            {enabled
              ? "Open Road · Following you"
              : available
                ? "Off · Follows your timing"
                : "Play a chord to enable the band"}
          </small>
        </div>
      </div>
      {enabled && (
        <div className="band-density" aria-label="Band density">
          {([1, 2, 3] as const).map((value) => (
            <button
              key={value}
              className={density === value ? "is-active" : ""}
              onClick={() => void changeDensity(value)}
            >
              {value === 1 ? "Light" : value === 2 ? "Full" : "Wide"}
            </button>
          ))}
        </div>
      )}
      <button
        className={`toggle ${enabled ? "is-on" : ""}`}
        onClick={() => void toggleBand()}
        aria-label={`Turn responsive band ${enabled ? "off" : "on"}`}
        aria-pressed={enabled}
        disabled={!available}
      >
        <span />
        <em>{enabled ? "On" : "Off"}</em>
      </button>
    </div>
  );
}

function PlaySpace({
  inputMode,
  setInputMode,
  listeningState,
  onMentor,
  onMenu,
  onProfile,
  onOpenBuild,
  liveChord,
  capturedProgression,
  setCapturedProgression,
}: {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  listeningState: ListeningState;
  onMentor: () => void;
  onMenu: () => void;
  onProfile: () => void;
  onOpenBuild: () => void;
  liveChord: string | null;
  capturedProgression: ProgressionChord[];
  setCapturedProgression: (
    update: ProgressionChord[] | ((current: ProgressionChord[]) => ProgressionChord[]),
  ) => void;
}) {
  const [assistance, setAssistance] = useState<AssistanceLevel>("developing");
  const [activeIndex, setActiveIndex] = useState(0);
  const [manualChord, setManualChord] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<EmotionalIntent | null>(null);
  const [tuningId, setTuningId] = useState<GuitarTuningId>("standard");
  const [capo, setCapo] = useState(0);
  const [shapeFinderOpen, setShapeFinderOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(inputMode === "demo");

  const takePreviewRef = useRef<ChordPreviewPlayer | null>(null);
  const currentChord = manualChord
    ? { id: "manual", name: manualChord, numeral: manualChord.endsWith("m") ? "ii" : "I", beats: 4 }
    : inputMode === "listening" && liveChord
      ? { id: "live", name: liveChord, numeral: liveChord.endsWith("m") ? "vi" : "I", beats: 4 }
      : inputMode === "demo"
        ? demoProgression[activeIndex]
        : inputMode === "idle" && capturedProgression.length > 0
          ? (capturedProgression[Math.min(activeIndex, capturedProgression.length - 1)] ?? null)
          : null;
  const suggestions = currentChord ? (chordMap[currentChord.name] ?? defaultSuggestions) : [];

  useEffect(
    () => () => {
      void takePreviewRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    if (inputMode !== "listening" || !liveChord) return;
    const timer = window.setTimeout(() => {
      setCapturedProgression((current) => {
        if (current.at(-1)?.name === liveChord) return current;
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            name: liveChord,
            numeral: liveChord.endsWith("m") ? "vi" : "I",
            beats: 4,
          },
        ];
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [inputMode, liveChord, setCapturedProgression]);

  useEffect(() => {
    if (inputMode !== "demo" || !isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % demoProgression.length);
      setSelectedSuggestion(null);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [inputMode, isPlaying]);

  return (
    <div className="play-space">
      <WorkspaceHeader
        title="Play"
        subtitle="Idea 07 · autosaved"
        onMenu={onMenu}
        onMentor={onMentor}
        onProfile={onProfile}
      />
      <div className="play-statusbar">
        <div className="key-status">
          <span>LIKELY KEY</span>
          <strong>
            {inputMode === "demo" || currentChord ? "C major" : "Waiting for a chord"}
          </strong>
          <em>{inputMode === "demo" || currentChord ? "87%" : "—"}</em>
        </div>
        <div className="tempo-status">
          <Gauge size={15} />
          <strong>{inputMode === "demo" || currentChord ? "96" : "—"}</strong>
          <span>BPM</span>
          <i />
          <span>4/4</span>
        </div>
        <div className="session-status">
          <span className="live-dot" />
          {inputMode === "demo"
            ? "Guided showcase"
            : inputMode === "manual"
              ? currentChord
                ? "Chord selected"
                : "Choose your first chord"
              : listeningState === "requesting"
                ? "Microphone permission"
                : currentChord
                  ? "Chord confirmed"
                  : "Waiting for your first chord"}
        </div>
      </div>
      {(inputMode === "listening" || inputMode === "manual") &&
        !currentChord &&
        capturedProgression.length === 0 && (
          <section className="first-chord-guide" aria-label="First chord">
            <div className="first-chord-guide__signal">
              <Mic2 size={17} />
            </div>
            <div>
              <span className="section-kicker">FIRST STEP</span>
              <strong>
                {inputMode === "manual" ? "Choose your first chord" : "Play one clean chord"}
              </strong>
              <p>
                {inputMode === "manual"
                  ? "Pick a chord to start your first idea."
                  : "Let it ring for two seconds. We’ll map where the music can go next."}
              </p>
            </div>
          </section>
        )}
      <SessionControls
        inputMode={inputMode}
        listeningState={listeningState}
        setInputMode={(mode) => {
          if (mode !== "manual") setManualChord(null);
          if (mode === "demo" && capturedProgression.length === 0) {
            setCapturedProgression(demoProgression);
          }
          setInputMode(mode);
        }}
        assistance={assistance}
        setAssistance={setAssistance}
        currentChord={currentChord}
        setCurrentChordName={(name) => {
          setManualChord(name);
          setSelectedSuggestion(null);
          setCapturedProgression((current) =>
            current.at(-1)?.name === name
              ? current
              : [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    name,
                    numeral: name.endsWith("m") ? "vi" : "I",
                    beats: 4,
                  },
                ],
          );
        }}
      />
      <div className="guitar-setup-bar" aria-label="Guitar setup">
        <label>
          <Guitar size={15} />
          <span>TUNING</span>
          <select
            value={tuningId}
            onChange={(event) => setTuningId(event.target.value as GuitarTuningId)}
          >
            {GUITAR_TUNINGS.map((tuning) => (
              <option key={tuning.id} value={tuning.id}>
                {tuning.shortLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>CAPO</span>
          <input
            type="number"
            min={0}
            max={12}
            value={capo}
            onChange={(event) =>
              setCapo(Math.max(0, Math.min(12, Number(event.target.value) || 0)))
            }
          />
        </label>
        <button className="secondary-button" onClick={() => setShapeFinderOpen((open) => !open)}>
          <Search size={15} /> {shapeFinderOpen ? "Hide shape finder" : "Find a chord from frets"}
        </button>
      </div>
      {shapeFinderOpen && (
        <ShapeFinder
          tuningId={tuningId}
          capo={capo}
          setTuningId={setTuningId}
          setCapo={setCapo}
          onClose={() => setShapeFinderOpen(false)}
          onUseChord={(name, frets) => {
            const voicing = createGuitarVoicing(name, frets, tuningId, capo, "Shape Finder shape");
            setManualChord(name);
            setInputMode("manual");
            setCapturedProgression((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                name,
                numeral: name.includes("m") ? "vi" : "I",
                beats: 4,
                voicing,
                tuning: tuningId,
                capo,
              },
            ]);
            setShapeFinderOpen(false);
          }}
        />
      )}
      <main className="play-workspace">
        <section className="compass-panel" aria-label="Harmonic Compass">
          <div className="compass-panel__intro">
            <span className="section-kicker">HARMONIC COMPASS</span>
            <p>Choose a destination or keep playing. The map moves with you.</p>
          </div>
          <HarmonicCompass
            currentChord={currentChord}
            inputMode={inputMode}
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
            setSelectedSuggestion={setSelectedSuggestion}
            assistance={assistance}
            tuningId={tuningId}
            capo={capo}
            previousVoicing={capturedProgression.at(-1)?.voicing}
            onUseVoicing={(name, voicing) => {
              setManualChord(name);
              setInputMode("manual");
              setCapturedProgression((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  name,
                  numeral: name.includes("m") ? "vi" : "I",
                  beats: 4,
                  voicing,
                  tuning: tuningId,
                  capo,
                },
              ]);
            }}
          />
          <div className="compass-legend">
            <span>
              <i className="is-natural" /> Natural
            </span>
            <span>
              <i className="is-adventurous" /> Adventurous
            </span>
            <span>
              <i className="is-borrowed" /> Borrowed
            </span>
          </div>
        </section>
        <aside className="play-sidebar">
          <EmotionalTray selectedIntent={selectedIntent} setSelectedIntent={setSelectedIntent} />
          <BandControl
            progression={capturedProgression.map((chord) => chord.name)}
            available={Boolean(currentChord)}
          />
          <button
            className="context-insight"
            onClick={onMentor}
            aria-label="Ask Compass about your current harmony"
            disabled={!currentChord}
          >
            <span>
              <WandSparkles size={16} />
            </span>
            <div>
              <strong>
                {currentChord ? "Ask about this harmony." : "Compass Coach is ready."}
              </strong>
              <p>
                {currentChord
                  ? "Get a plain-language explanation of what you just heard."
                  : "Play a chord first, then ask why it works."}
              </p>
            </div>
            <ArrowRight size={16} />
          </button>
        </aside>
      </main>
      <TakeRibbon
        progression={capturedProgression}
        activeIndex={activeIndex}
        isPlaying={isPlaying}
        setIsPlaying={(value) => {
          setIsPlaying(value);
          if (!value) {
            void takePreviewRef.current?.stop();
            return;
          }
          takePreviewRef.current ??= createPreviewPlayer(setIsPlaying);
          void takePreviewRef.current.previewGuitarRoute(
            capturedProgression.map((chord) => chord.name),
            96,
            "strum",
            capturedProgression.map((chord) => chord.voicing),
            capturedProgression.at(-1)?.tuning,
            capturedProgression.at(-1)?.capo ?? 0,
          );
        }}
        setActiveIndex={(index) => {
          setActiveIndex(index);
          setManualChord(null);
        }}
        onAddChord={() => {
          const next = suggestions[0] ?? defaultSuggestions[0];
          setManualChord(next.chord);
          setInputMode("manual");
          setCapturedProgression((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              name: next.chord,
              numeral: next.numeral,
              beats: 4,
            },
          ]);
        }}
        onOpenBuild={onOpenBuild}
      />
    </div>
  );
}

interface BuildSection {
  id: string;
  name: string;
  color: string;
  chords: ProgressionChord[];
}

const initialBuildSections: BuildSection[] = [
  { id: "verse", name: "Verse", color: "sage", chords: demoProgression.slice(0, 4) },
  {
    id: "chorus",
    name: "Chorus",
    color: "gold",
    chords: [
      { id: "b1", name: "F", numeral: "IV", beats: 4 },
      { id: "b2", name: "G", numeral: "V", beats: 4 },
      { id: "b3", name: "C", numeral: "I", beats: 4 },
      { id: "b4", name: "Am", numeral: "vi", beats: 4 },
    ],
  },
  { id: "bridge", name: "Bridge", color: "blue", chords: demoProgression.slice(3) },
];

function BuildSpace({
  onMentor,
  onMenu,
  onProfile,
  startingProgression = [],
  startingSections,
  sessionMode = false,
  onSectionsChange,
}: {
  onMentor: () => void;
  onMenu: () => void;
  onProfile: () => void;
  startingProgression?: ProgressionChord[];
  startingSections?: BuildSection[];
  sessionMode?: boolean;
  onSectionsChange?: (sections: BuildSection[]) => void;
}) {
  const [sections, setSections] = useState<BuildSection[]>(() =>
    (startingSections?.length
      ? startingSections
      : sessionMode && startingProgression.length
        ? buildSectionsForProgression(startingProgression)
        : initialBuildSections
    ).map((item) => ({
      ...item,
      chords: item.chords.map((chord) => ({ ...chord })),
    })),
  );
  const [activeSection, setActiveSection] = useState(0);
  const [variation, setVariation] = useState<"A" | "B">("A");
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [playbackScope, setPlaybackScope] = useState<"section" | "song">("section");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [feedback, setFeedback] = useState("Ready to shape your song.");
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const [undoHistory, setUndoHistory] = useState<BuildSection[][]>([]);
  const [redoHistory, setRedoHistory] = useState<BuildSection[][]>([]);
  const previewRef = useRef<ChordPreviewPlayer | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const section = sections[activeSection] ?? sections[0]!;

  const chordNameForVariation = (chord: ProgressionChord, index: number) =>
    variation === "B" && index === 2 ? "Em" : chord.name;
  const numeralForVariation = (chord: ProgressionChord, index: number) =>
    variation === "B" && index === 2 ? "iii" : chord.numeral;

  const commitSections = (next: BuildSection[], message: string) => {
    setUndoHistory((current) => [...current.slice(-19), sections]);
    setRedoHistory([]);
    setSections(next);
    onSectionsChange?.(next);
    setFeedback(message);
  };

  const updateActiveChords = (nextChords: ProgressionChord[], message: string) => {
    commitSections(
      sections.map((item, index) =>
        index === activeSection ? { ...item, chords: nextChords } : item,
      ),
      message,
    );
  };

  const undo = () => {
    const previous = undoHistory.at(-1);
    if (!previous) return;
    setRedoHistory((current) => [sections, ...current].slice(0, 20));
    setUndoHistory((current) => current.slice(0, -1));
    setSections(previous);
    onSectionsChange?.(previous);
    setActiveSection((current) => Math.min(current, previous.length - 1));
    setFeedback("Undid the last arrangement change.");
  };

  const redo = () => {
    const next = redoHistory[0];
    if (!next) return;
    setUndoHistory((current) => [...current, sections].slice(-20));
    setRedoHistory((current) => current.slice(1));
    setSections(next);
    onSectionsChange?.(next);
    setActiveSection((current) => Math.min(current, next.length - 1));
    setFeedback("Restored the arrangement change.");
  };

  const addSection = () => {
    const nextIndex = sections.length;
    const next: BuildSection = {
      id: crypto.randomUUID(),
      name: `Section ${nextIndex + 1}`,
      color: ["sage", "gold", "blue"][nextIndex % 3]!,
      chords: [
        { id: crypto.randomUUID(), name: "Am", numeral: "vi", beats: 4 },
        { id: crypto.randomUUID(), name: "F", numeral: "IV", beats: 4 },
        { id: crypto.randomUUID(), name: "G", numeral: "V", beats: 4 },
        { id: crypto.randomUUID(), name: "C", numeral: "I", beats: 4 },
      ],
    };
    commitSections([...sections, next], `${next.name} added.`);
    setActiveSection(nextIndex);
    setVariation("A");
  };

  const duplicateSection = () => {
    const duplicate: BuildSection = {
      ...section,
      id: crypto.randomUUID(),
      name: `${section.name} copy`,
      chords: section.chords.map((chord) => ({ ...chord, id: crypto.randomUUID() })),
    };
    const next = [...sections];
    next.splice(activeSection + 1, 0, duplicate);
    commitSections(next, `${section.name} duplicated.`);
    setActiveSection(activeSection + 1);
  };

  const deleteSection = () => {
    if (sections.length === 1) {
      setFeedback("A song needs at least one section.");
      return;
    }
    const next = sections.filter((_, index) => index !== activeSection);
    commitSections(next, `${section.name} removed.`);
    setActiveSection(Math.max(0, activeSection - 1));
  };

  const addChord = () => {
    const options = [
      { name: "C", numeral: "I" },
      { name: "G", numeral: "V" },
      { name: "Am", numeral: "vi" },
      { name: "F", numeral: "IV" },
    ];
    const option = options[section.chords.length % options.length]!;
    updateActiveChords(
      [...section.chords, { id: crypto.randomUUID(), ...option, beats: 4 }],
      `${option.name} added to ${section.name}.`,
    );
  };

  const moveChord = (index: number) => {
    if (section.chords.length < 2) return;
    const target = index === section.chords.length - 1 ? index - 1 : index + 1;
    const next = [...section.chords];
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateActiveChords(next, `${section.chords[index]!.name} moved in the progression.`);
  };

  const cycleDuration = (index: number) => {
    const next = section.chords.map((chord, chordIndex) =>
      chordIndex === index
        ? { ...chord, beats: chord.beats === 2 ? 4 : chord.beats === 4 ? 8 : 2 }
        : chord,
    );
    updateActiveChords(next, `${section.chords[index]!.name} duration changed.`);
  };

  const saveVersion = async () => {
    setSaveState("saving");
    try {
      const database = getDatabase();
      const timestamp = new Date();
      if (sessionMode) {
        const versionId = crypto.randomUUID();
        const userSong: SongDocument = {
          id: crypto.randomUUID(),
          schemaVersion: 1,
          title: "Your first idea",
          status: "idea",
          bpm: 96,
          key: {
            primary: { tonic: 0, mode: "major", confidence: 0.35 },
            alternatives: [],
            locked: false,
          },
          activeVersionId: versionId,
          versions: [
            {
              id: versionId,
              label: "First capture",
              createdAt: timestamp.toISOString(),
              sections: sections.map((item) => ({
                id: crypto.randomUUID(),
                name: item.name,
                type: "idea" as const,
                chords: item.chords.map((chord) => ({
                  id: crypto.randomUUID(),
                  chord: parseChordName(chord.name),
                  beats: chord.beats,
                })),
              })),
            },
          ],
          tags: ["session"],
          createdAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString(),
        };
        await saveSong(userSong, database);
      } else {
        await ensureSeeded(database);
        const song = await database.songs.get(seedSongIds.borrowedLight);
        if (!song) throw new Error("seed-song-missing");
        const activeVersion = song.versions.find((version) => version.id === song.activeVersionId);
        if (!activeVersion) throw new Error("active-version-missing");
        const version = {
          ...activeVersion,
          id: crypto.randomUUID(),
          label: `Saved · ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          createdAt: timestamp.toISOString(),
        };
        await saveSong(addVersion(song, version, { activate: false }), database);
      }
      setSaveState("saved");
      setFeedback("Version saved locally.");
      window.setTimeout(() => setSaveState("idle"), 2400);
    } catch {
      setSaveState("error");
      setFeedback("This version could not be saved. Try again.");
    }
  };

  useEffect(
    () => () => {
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
      void previewRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    if (!playing) {
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
      void previewRef.current?.stop();
      return;
    }
    let cancelled = false;
    const chordNames =
      playbackScope === "song"
        ? sections.flatMap((item) => item.chords.map((chord) => chord.name))
        : section.chords.map((chord, index) =>
            variation === "B" && index === 2 ? "Em" : chord.name,
          );
    const durationMs = (chordNames.length * (60 / 96) * 2 + 0.75) * 1000;
    const playOnce = async () => {
      if (cancelled) return;
      previewRef.current ??= createPreviewPlayer();
      await previewRef.current.previewGuitarRoute(
        chordNames,
        96,
        "strum",
        playbackScope === "song"
          ? sections.flatMap((item) => item.chords.map((chord) => chord.voicing))
          : section.chords.map((chord) => chord.voicing),
        section.chords.find((chord) => chord.tuning)?.tuning,
        section.chords.find((chord) => chord.capo !== undefined)?.capo ?? 0,
      );
      loopTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (looping) void playOnce();
        else setPlaying(false);
      }, durationMs);
    };
    void playOnce();
    return () => {
      cancelled = true;
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
      void previewRef.current?.stop();
    };
  }, [activeSection, looping, playbackScope, playing, section, sections, variation]);

  const previewComparison = async () => {
    setPlaying(false);
    previewRef.current ??= createPreviewPlayer();
    const a = section.chords.map((chord) => chord.name);
    const b = section.chords.map((chord, index) => chordNameForVariation(chord, index));
    await previewRef.current.previewGuitarRoute([...a, ...b], 112, "arpeggio");
    setFeedback("Playing variation A, then B as a guitar arpeggio.");
  };

  return (
    <div className="build-space">
      <WorkspaceHeader
        title="Build"
        subtitle={sessionMode ? "Your idea · saved locally" : "Borrowed Light · saved locally"}
        onMenu={onMenu}
        onMentor={onMentor}
        onProfile={onProfile}
      />
      <main className="build-workspace">
        <header className="build-toolbar">
          <div className="song-title-control">
            <span className="section-kicker">SONG WORKSPACE</span>
            <h1>{sessionMode ? "Your first idea" : "Borrowed Light"}</h1>
            <button
              className="title-menu"
              aria-label="Song options"
              aria-expanded={songMenuOpen}
              onClick={() => setSongMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>
            {songMenuOpen && (
              <div className="song-options-menu" role="menu">
                <button role="menuitem" onClick={() => void saveVersion()}>
                  <Copy size={14} /> Save a version
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setSongMenuOpen(false);
                    setFeedback("Borrowed Light is stored on this device and ready offline.");
                  }}
                >
                  <Lock size={14} /> Storage details
                </button>
              </div>
            )}
          </div>
          <div className="build-toolbar__actions">
            <button
              className="icon-button"
              aria-label="Undo"
              onClick={undo}
              disabled={!undoHistory.length}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              onClick={redo}
              disabled={!redoHistory.length}
            >
              <ArrowRight size={17} />
            </button>
            <span className="toolbar-divider" />
            <button
              className="secondary-button"
              onClick={() => void saveVersion()}
              disabled={saveState === "saving"}
            >
              {saveState === "saved" ? <Check size={15} /> : <Copy size={15} />}
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved locally"
                  : saveState === "error"
                    ? "Try again"
                    : "Save version"}
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setPlaybackScope("song");
                setPlaying((current) => !(current && playbackScope === "song"));
              }}
            >
              {playing && playbackScope === "song" ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
              {playing && playbackScope === "song" ? "Pause song" : "Play song"}
            </button>
          </div>
        </header>
        <p className="build-feedback" role="status">
          {feedback}
        </p>
        <section className="song-map" aria-labelledby="song-map-heading">
          <div className="song-map__heading">
            <div>
              <span className="section-kicker">ARRANGEMENT</span>
              <h2 id="song-map-heading">Song map</h2>
            </div>
            <span>{sections.length} sections · 2:48 estimated</span>
          </div>
          <div className="section-tabs" role="tablist" aria-label="Song sections">
            {sections.map((item, index) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={activeSection === index}
                className={`${activeSection === index ? "is-active" : ""} section-tab--${item.color}`}
                onClick={() => {
                  setPlaying(false);
                  setActiveSection(index);
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.name}</strong>
                <small>{index === 0 ? "× 2" : "× 1"}</small>
              </button>
            ))}
            <button className="section-tab__add" onClick={addSection}>
              <Plus size={18} /> Add section
            </button>
          </div>
        </section>
        <section className="section-editor" aria-labelledby="section-editor-heading">
          <header>
            <div>
              <span className="section-kicker">
                SECTION {String(activeSection + 1).padStart(2, "0")}
              </span>
              <h2 id="section-editor-heading">{section.name}</h2>
            </div>
            <div className="variation-switch" aria-label="Variation">
              <span>VARIATION</span>
              <button
                className={variation === "A" ? "is-active" : ""}
                onClick={() => setVariation("A")}
              >
                A
              </button>
              <button
                className={variation === "B" ? "is-active" : ""}
                onClick={() => setVariation("B")}
              >
                B
              </button>
              <button
                aria-label="Add variation"
                onClick={() => {
                  setVariation("B");
                  setFeedback("Variation B is ready to compare.");
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="section-editor__actions">
              <button
                className="icon-button"
                aria-label="Duplicate section"
                onClick={duplicateSection}
              >
                <Copy size={16} />
              </button>
              <button className="icon-button" aria-label="Delete section" onClick={deleteSection}>
                <Trash2 size={16} />
              </button>
            </div>
          </header>
          <div className="chord-blocks">
            {section.chords.map((chord, index) => (
              <article
                key={chord.id}
                className={`chord-block ${chord.color === "borrowed" ? "is-borrowed" : ""}`}
              >
                <button
                  className="chord-block__drag"
                  aria-label={`Move ${chord.name} later`}
                  onClick={() => moveChord(index)}
                >
                  <span />
                  <span />
                  <span />
                </button>
                <span className="chord-block__count">{String(index + 1).padStart(2, "0")}</span>
                <strong>{chordNameForVariation(chord, index)}</strong>
                <em>{numeralForVariation(chord, index)}</em>
                {chord.voicing && (
                  <small className="chord-block__voicing">{chord.voicing.name}</small>
                )}
                <div className="chord-block__beats">
                  {Array.from({ length: chord.beats }).map((_, beat) => (
                    <i key={beat} className={beat === 0 ? "is-strong" : ""} />
                  ))}
                </div>
                <button className="chord-block__duration" onClick={() => cycleDuration(index)}>
                  {chord.beats} beats <ChevronDown size={12} />
                </button>
              </article>
            ))}
            <button className="chord-block chord-block--add" onClick={addChord}>
              <Plus size={20} />
              <span>Add chord</span>
            </button>
          </div>
          <div className="section-transport">
            <button
              className="transport-button"
              onClick={() => {
                setPlaybackScope("section");
                setPlaying((current) => !(current && playbackScope === "section"));
              }}
              aria-label={playing && playbackScope === "section" ? "Pause section" : "Play section"}
            >
              {playing && playbackScope === "section" ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
            <span>00:00</span>
            <div className="section-transport__line">
              <i style={{ width: playing ? "42%" : "0%" }} />
            </div>
            <span>00:20</span>
            <button
              className={`loop-button ${looping ? "is-active" : ""}`}
              aria-pressed={looping}
              onClick={() => setLooping((current) => !current)}
            >
              <RotateCcw size={14} /> {looping ? "Looping" : "Loop"}
            </button>
          </div>
        </section>
        <section className="build-bottom">
          <div className="variation-compare">
            <span className="section-kicker">COMPARE</span>
            <h3>A quieter turn for the second verse</h3>
            <p>
              Variation B replaces Am with Em, holding back the emotional drop until the chorus.
            </p>
            <div>
              <button className="secondary-button" onClick={() => void previewComparison()}>
                <Play size={14} /> Hear A / B
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setActiveSection(0);
                  setVariation("B");
                  setFeedback("Variation B is now selected for verse two.");
                }}
              >
                Use in verse two <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="arrangement-settings">
            <div>
              <span>Tempo</span>
              <strong>96 BPM</strong>
            </div>
            <div>
              <span>Key</span>
              <strong>C major</strong>
            </div>
            <div>
              <span>Band</span>
              <strong>Open Road</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
const growSteps = [
  { title: "Listen", note: "Hear your progression once", icon: Headphones },
  { title: "Predict", note: "Choose where it resolves", icon: CircleHelp },
  { title: "Play", note: "Find it on your guitar", icon: Guitar },
];

function GrowSpace({
  onMentor,
  onMenu,
  onProfile,
  hasSessionHistory,
}: {
  onMentor: () => void;
  onMenu: () => void;
  onProfile: () => void;
  hasSessionHistory: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const previewRef = useRef<ChordPreviewPlayer | null>(null);

  useEffect(
    () => () => {
      void previewRef.current?.stop();
    },
    [],
  );

  const replayChallenge = async () => {
    previewRef.current ??= createPreviewPlayer(setReplaying);
    await previewRef.current.previewGuitarRoute(["Fm", "C"], 78, "arpeggio");
  };

  const chooseAnswer = async (chord: string) => {
    setAnswer(chord);
    previewRef.current ??= createPreviewPlayer(setReplaying);
    await previewRef.current.previewGuitarChord(chord, { pattern: "strum" });
  };
  return (
    <div className="grow-space">
      <WorkspaceHeader
        title="Grow"
        subtitle="Your next 5 minutes"
        onMenu={onMenu}
        onMentor={onMentor}
        onProfile={onProfile}
      />
      <main className="grow-workspace">
        <section className="grow-intro">
          <div>
            <span className="section-kicker">MADE FROM YOUR MUSIC</span>
            <h1>Find home without the map.</h1>
            <p>
              {hasSessionHistory
                ? "Your recent ideas are shaping this challenge. Today, let’s hear where the minor iv wants to land."
                : "Make a few chords in Play and your next challenge will come from what you discover."}
            </p>
          </div>
          <div className="grow-streak">
            <span>YOUR MOMENTUM</span>
            <strong>{hasSessionHistory ? "1" : "—"}</strong>
            <em>{hasSessionHistory ? "idea started" : "No streak yet"}</em>
            {hasSessionHistory && (
              <div>
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <i key={`${day}-${index}`} className={index === 0 ? "is-complete" : ""}>
                    {index === 0 ? <Check size={10} /> : day}
                  </i>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className={`challenge-stage ${started ? "is-started" : ""}`}>
          <header>
            <div className="challenge-number">01</div>
            <div>
              <span className="section-kicker">TODAY’S CHALLENGE · 5 MIN</span>
              <h2>Find Home</h2>
            </div>
            <span className="difficulty">EAR · DEVELOPING</span>
          </header>
          {!started ? (
            <>
              <div className="challenge-visual" aria-hidden="true">
                <div className="challenge-visual__rings" />
                <span className="challenge-visual__chord">Fm</span>
                <span className="challenge-visual__question">?</span>
                <i />
              </div>
              <p className="challenge-prompt">
                Can you hear which chord releases this borrowed tension?
              </p>
              <div className="challenge-steps">
                {growSteps.map(({ title, note, icon: Icon }, index) => (
                  <div key={title}>
                    <span>0{index + 1}</span>
                    <Icon size={19} />
                    <div>
                      <strong>{title}</strong>
                      <small>{note}</small>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="primary-button primary-button--large"
                onClick={() => {
                  setStarted(true);
                  void replayChallenge();
                }}
              >
                <Play size={17} fill="currentColor" /> Begin challenge
              </button>
            </>
          ) : (
            <div className="challenge-live">
              <button
                className={`challenge-audio ${replaying ? "is-playing" : ""}`}
                aria-label={replaying ? "Playing progression" : "Replay progression"}
                onClick={() => void replayChallenge()}
              >
                <Volume2 size={25} />
                <span>
                  {[18, 32, 55, 80, 44, 62, 28, 47, 71, 35].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </span>
                <em>Replay</em>
              </button>
              <h3>Which chord feels like home?</h3>
              <div className="challenge-answers">
                {["Am", "C", "G"].map((chord) => (
                  <button
                    key={chord}
                    className={`${answer === chord ? "is-selected" : ""} ${answer && chord === "C" ? "is-correct" : ""}`}
                    onClick={() => void chooseAnswer(chord)}
                  >
                    {chord}
                    {answer && chord === "C" && <Check size={16} />}
                  </button>
                ))}
              </div>
              {answer && (
                <div
                  className={`challenge-feedback ${answer === "C" ? "is-correct" : ""}`}
                  role="status"
                >
                  <Sparkles size={18} />
                  <div>
                    <strong>
                      {answer === "C" ? "That’s home." : "Listen for a more settled release."}
                    </strong>
                    <p>
                      {answer === "C"
                        ? "Fm → C is the minor iv resolving to I—the bittersweet turn from your song Borrowed Light."
                        : "Try replaying it and notice which option removes all the tension."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="growth-profile">
          <header>
            <div>
              <span className="section-kicker">YOUR MUSICAL EAR</span>
              <h2>What’s becoming instinct</h2>
            </div>
            <button className="text-button" onClick={onProfile}>
              View profile <ArrowRight size={14} />
            </button>
          </header>
          <div className="skill-lines">
            {[
              ["V → I resolution", 86, "Strong"],
              ["Major-key movement", 72, "Growing"],
              ["Borrowed harmony", 48, "Exploring"],
              ["Section contrast", 34, "Next up"],
            ].map(([name, value, label]) => (
              <div key={String(name)}>
                <span>{name}</span>
                <div>
                  <i style={{ width: `${value}%` }} />
                </div>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

interface LibraryItem {
  id: string;
  title: string;
  type: "Song" | "Idea" | "Session";
  key: string;
  bpm: number;
  chords: string[];
  date: string;
  favorite: boolean;
  color: "lime" | "sand" | "blue" | "plum";
}

const libraryItems: LibraryItem[] = [
  {
    id: "l1",
    title: "Borrowed Light",
    type: "Song",
    key: "C major",
    bpm: 96,
    chords: ["C", "G", "Am", "F", "Fm"],
    date: "Today",
    favorite: true,
    color: "lime",
  },
  {
    id: "l2",
    title: "Open Road",
    type: "Song",
    key: "G major",
    bpm: 112,
    chords: ["G", "D", "Em", "C"],
    date: "Yesterday",
    favorite: false,
    color: "sand",
  },
  {
    id: "l3",
    title: "Blue Hour",
    type: "Idea",
    key: "D minor",
    bpm: 78,
    chords: ["Dm", "B♭", "F", "C"],
    date: "Jul 22",
    favorite: true,
    color: "blue",
  },
  {
    id: "l4",
    title: "Late Window",
    type: "Session",
    key: "A minor",
    bpm: 84,
    chords: ["Am", "F", "C", "G"],
    date: "Jul 19",
    favorite: false,
    color: "plum",
  },
];

const discoveryItems = [
  ["IV → iv → I", "The bittersweet return", "Used 3 times"],
  ["ii → V → I", "The strong homecoming", "Used 7 times"],
  ["I → III7 → vi", "The bright side-door", "New"],
  ["I → V/vi → vi", "A stronger minor arrival", "Used twice"],
  ["vi → IV → I → V", "The open-road loop", "Growing"],
  ["I → ♭VII → IV", "A wide borrowed lift", "Explore next"],
] as const;

function mapStoredSongs(songs: SongDocument[]): LibraryItem[] {
  const colors: LibraryItem["color"][] = ["lime", "sand", "blue", "plum"];
  return songs.map((song, index): LibraryItem => {
    const version =
      song.versions.find((candidate) => candidate.id === song.activeVersionId) ?? song.versions[0];
    const primary = song.key?.primary;
    const keyName = primary
      ? `${formatChord({ root: primary.tonic, quality: "major" })} ${primary.mode}`
      : "Key open";
    const favorite = song.title === "Borrowed Light" || song.title === "Blue Hour";
    return {
      id: song.id,
      title: song.title,
      type: song.title === "Blue Hour" ? "Idea" : "Song",
      key: keyName,
      bpm: song.bpm,
      chords: version.sections
        .flatMap((section) => section.chords)
        .slice(0, 6)
        .map((block) => formatChord(block.chord)),
      date: song.tags.includes("example") ? "Ready" : "Saved locally",
      favorite,
      color: colors[index % colors.length]!,
    };
  });
}
function LibrarySpace({
  onMentor,
  onResume,
  onMenu,
  onProfile,
}: {
  onMentor: () => void;
  onResume: () => void;
  onMenu: () => void;
  onProfile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortMode, setSortMode] = useState<"updated" | "name">("updated");
  const [items, setItems] = useState<LibraryItem[]>(libraryItems);
  const [favorites, setFavorites] = useState(
    () => new Set(libraryItems.filter((item) => item.favorite).map((item) => item.id)),
  );
  const [importState, setImportState] = useState("Archives stay on this device.");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showAllDiscoveries, setShowAllDiscoveries] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<ChordPreviewPlayer | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const database = getDatabase();
        await ensureSeeded(database);
        const songs = await database.songs.orderBy("updatedAt").reverse().toArray();
        const mapped = mapStoredSongs(songs);
        if (active && mapped.length > 0) {
          setItems(mapped);
          setFavorites(new Set(mapped.filter((item) => item.favorite).map((item) => item.id)));
        }
      } catch {
        // IndexedDB can be unavailable in strict private modes; showcase seeds remain usable.
      }
    })();
    return () => {
      active = false;
      void previewRef.current?.stop();
    };
  }, []);

  const filtered = items
    .filter(
      (item) =>
        (filter === "All" || item.type === filter) &&
        item.title.toLowerCase().includes(query.toLowerCase()),
    )
    .toSorted((a, b) => (sortMode === "name" ? a.title.localeCompare(b.title) : 0));

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setImportState("Checking archive…");
    try {
      const result = await importLibrary(new Uint8Array(await file.arrayBuffer()));
      const songs = await getDatabase().songs.orderBy("updatedAt").reverse().toArray();
      const mapped = mapStoredSongs(songs);
      setItems(mapped);
      setFavorites(new Set(mapped.filter((item) => item.favorite).map((item) => item.id)));
      setImportState(
        `${result.importedSongs} imported · ${result.skippedSongs} already in your library.`,
      );
    } catch {
      setImportState("That file is not a valid Harmonic Compass archive.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const previewItem = async (item: LibraryItem) => {
    previewRef.current ??= createPreviewPlayer();
    await previewRef.current.previewGuitarRoute(item.chords, item.bpm, "strum");
    setImportState(`Playing ${item.title} as a guitar progression.`);
  };
  return (
    <div className="library-space">
      <WorkspaceHeader
        title="Library"
        subtitle="Your musical memory"
        onMenu={onMenu}
        onMentor={onMentor}
        onProfile={onProfile}
      />
      <main className="library-workspace">
        <header className="library-heading">
          <div>
            <span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span>
            <h1>Your music</h1>
          </div>
          <div className="library-heading__actions">
            <button className="secondary-button" onClick={() => importInputRef.current?.click()}>
              <Upload size={15} /> Import
            </button>
            <input
              ref={importInputRef}
              className="sr-only"
              type="file"
              aria-label="Import Harmonic Compass archive"
              accept=".zip,.hcompass.zip,application/zip"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
            <button className="primary-button" onClick={onResume}>
              <Plus size={15} /> New idea
            </button>
          </div>
        </header>
        <p className="library-import-status" role="status">
          {importState}
        </p>
        <section className="library-tools" aria-label="Library filters">
          <label className="library-search">
            <Search size={17} />
            <span className="sr-only">Search your music</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your music…"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <div className="library-filters">
            {["All", "Song", "Idea", "Session"].map((item) => (
              <button
                key={item}
                className={filter === item ? "is-active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className="sort-button"
            onClick={() => setSortMode((current) => (current === "updated" ? "name" : "updated"))}
            aria-label={`Sort by ${sortMode === "updated" ? "name" : "last updated"}`}
          >
            {sortMode === "updated" ? "Last updated" : "Name"} <ChevronDown size={14} />
          </button>
        </section>
        <section className="library-list" aria-label="Saved music">
          <div className="library-list__labels">
            <span>NAME</span>
            <span>PROGRESSION</span>
            <span>KEY / TEMPO</span>
            <span>UPDATED</span>
            <span />
          </div>
          {filtered.map((item) => (
            <article key={item.id} className="library-item">
              <div className="library-item__identity">
                <div className={`idea-cover idea-cover--${item.color}`} aria-hidden="true">
                  <Music2 size={20} />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.type}</span>
                </div>
              </div>
              <div className="library-item__progression">
                {item.chords.map((chord, index) => (
                  <span key={`${chord}-${index}`}>{chord}</span>
                ))}
              </div>
              <div className="library-item__context">
                <strong>{item.key}</strong>
                <span>{item.bpm} BPM</span>
              </div>
              <time>{item.date}</time>
              <div className="library-item__actions">
                <button
                  onClick={() => toggleFavorite(item.id)}
                  aria-label={`${favorites.has(item.id) ? "Remove" : "Add"} ${item.title} ${favorites.has(item.id) ? "from" : "to"} favorites`}
                >
                  <Star size={16} fill={favorites.has(item.id) ? "currentColor" : "none"} />
                </button>
                <button className="resume-button" onClick={onResume}>
                  Resume <ArrowRight size={14} />
                </button>
                <button
                  aria-label={`More options for ${item.title}`}
                  aria-expanded={selectedItem === item.id}
                  onClick={() =>
                    setSelectedItem((current) => (current === item.id ? null : item.id))
                  }
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
              {selectedItem === item.id && (
                <div className="library-item__menu">
                  <span>{item.chords.join(" → ")}</span>
                  <button onClick={() => void previewItem(item)}>
                    <Volume2 size={14} /> Preview guitar
                  </button>
                  <button onClick={onResume}>
                    <ListMusic size={14} /> Open in Build
                  </button>
                </div>
              )}
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="library-empty">
              <Search size={24} />
              <strong>No ideas found</strong>
              <p>Try another search or filter.</p>
            </div>
          )}
        </section>
        <section className="discoveries">
          <header>
            <div>
              <span className="section-kicker">SOUNDS YOU’VE DISCOVERED</span>
              <h2>Your chord vocabulary</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setShowAllDiscoveries((current) => !current)}
            >
              {showAllDiscoveries ? "Show highlights" : "See all 6"} <ArrowRight size={14} />
            </button>
          </header>
          <div className="discovery-list">
            {discoveryItems
              .slice(0, showAllDiscoveries ? discoveryItems.length : 3)
              .map(([movement, description, usage], index) => (
                <article key={movement}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{movement}</strong>
                    <p>{description}</p>
                  </div>
                  <em>{usage}</em>
                </article>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

type UtilityPanel = "settings" | "profile" | null;

function UtilityDrawer({
  panel,
  onClose,
  highContrast,
  setHighContrast,
  reducedMotion,
  setReducedMotion,
  hasSessionHistory,
}: {
  panel: UtilityPanel;
  onClose: () => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  hasSessionHistory: boolean;
}) {
  if (!panel) return null;
  const settings = panel === "settings";
  return (
    <>
      <button className="utility-scrim" aria-label={`Close ${panel}`} onClick={onClose} />
      <aside className="utility-drawer" aria-label={settings ? "Settings" : "Player profile"}>
        <header>
          <span>{settings ? <Settings2 size={18} /> : <Guitar size={18} />}</span>
          <div>
            <strong>{settings ? "Settings" : "Your musical ear"}</strong>
            <small>
              {settings
                ? "Local preferences"
                : hasSessionHistory
                  ? "Developing player"
                  : "Ready to begin"}
            </small>
          </div>
          <button className="icon-button" aria-label={`Close ${panel}`} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {settings ? (
          <div className="utility-drawer__body">
            <section>
              <span className="section-kicker">APPEARANCE</span>
              <button
                className="settings-row"
                role="switch"
                aria-checked={highContrast}
                onClick={() => setHighContrast(!highContrast)}
              >
                <span>
                  <strong>Higher contrast</strong>
                  <small>Strengthen text and fretboard detail</small>
                </span>
                <i className={highContrast ? "is-on" : ""} />
              </button>
              <button
                className="settings-row"
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion(!reducedMotion)}
              >
                <span>
                  <strong>Reduce motion</strong>
                  <small>Keep transitions quiet and immediate</small>
                </span>
                <i className={reducedMotion ? "is-on" : ""} />
              </button>
            </section>
            <section className="privacy-settings">
              <span className="section-kicker">PRIVACY</span>
              <strong>
                <Lock size={15} /> Audio stays here
              </strong>
              <p>
                Microphone analysis and saved ideas remain on this device. Only symbolic context
                reaches the optional text mentor.
              </p>
            </section>
          </div>
        ) : (
          <div className="utility-drawer__body profile-summary">
            {hasSessionHistory ? (
              <>
                <div className="profile-summary__level">
                  <span>04</span>
                  <div>
                    <strong>Finding color</strong>
                    <small>Your progress is growing from your ideas</small>
                  </div>
                </div>
                {[
                  ["V → I resolution", 86, "Strong"],
                  ["Major-key movement", 72, "Growing"],
                  ["Borrowed harmony", 48, "Exploring"],
                  ["Section contrast", 34, "Next up"],
                ].map(([skill, progress, label]) => (
                  <div className="profile-skill" key={String(skill)}>
                    <span>
                      <strong>{skill}</strong>
                      <small>{label}</small>
                    </span>
                    <i>
                      <b style={{ width: `${progress}%` }} />
                    </i>
                  </div>
                ))}
                <p>Your next best step: hear the minor iv resolve without looking at the map.</p>
              </>
            ) : (
              <>
                <span className="section-kicker">YOUR FIRST STEP</span>
                <h3>Make one idea in Play.</h3>
                <p>
                  Your musical profile will grow from the chords you choose and the routes you
                  explore.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
function MentorDrawer({
  open,
  onClose,
  currentChord = "C",
}: {
  open: boolean;
  onClose: () => void;
  currentChord?: string;
}) {
  const [question, setQuestion] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<{ source: "user" | "coach"; text: string }[]>([
    {
      source: "coach",
      text: "I’m following your session. Ask about the harmony, or tell me how you want this section to feel.",
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);
  const submit = async (text = question) => {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || isThinking) return;
    const lowerQuestion = cleanQuestion.toLowerCase();
    const intent = lowerQuestion.includes("dark")
      ? "darken"
      : lowerQuestion.includes("chorus") || lowerQuestion.includes("contrast")
        ? "contrast"
        : lowerQuestion.includes("why")
          ? "explain"
          : "teach";
    const key = { tonic: 0, mode: "major" as const, confidence: 0.87 };
    setMessages((current) => [...current, { source: "user", text: cleanQuestion }]);
    setQuestion("");
    setIsThinking(true);
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          question: cleanQuestion,
          intent,
          context: {
            currentChord: { root: 0, quality: "major" },
            key,
            progression: SHOWCASE_PROGRESSION,
            assistanceLevel: "developing",
            allowedSuggestions: getSuggestions({ root: 0, quality: "major" }, key),
          },
        }),
      });
      const payload = (await response.json()) as { answer?: unknown };
      if (!response.ok || typeof payload.answer !== "string") throw new Error("mentor-unavailable");
      setMessages((current) => [...current, { source: "coach", text: payload.answer as string }]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          source: "coach",
          text: `From ${currentChord}, try one familiar move and one color change. F → Fm → C keeps home in view while the borrowed Fm adds a bittersweet pull.`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <button
        className={`mentor-scrim ${open ? "is-open" : ""}`}
        aria-label="Close Compass mentor"
        onClick={onClose}
      />
      <aside
        className={`mentor-drawer ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        aria-label="Compass mentor"
      >
        <header className="mentor-drawer__header">
          <div className="mentor-orb">
            <Sparkles size={17} />
          </div>
          <div>
            <strong>Compass</strong>
            <span>
              <i /> Listening to this session
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close mentor">
            <X size={19} />
          </button>
        </header>
        <div className="mentor-context">
          <span>CURRENT CONTEXT</span>
          <div>
            <strong>{currentChord}</strong>
            <ArrowRight size={13} />
            <strong>?</strong>
            <em>C major · 96 BPM</em>
          </div>
        </div>
        <div className="mentor-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`mentor-message mentor-message--${message.source}`}>
              {message.source === "coach" && <Sparkles size={14} />}
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <div className="mentor-prompts">
          {["Why did that work?", "Make this darker", "Give me a chorus route"].map((prompt) => (
            <button key={prompt} onClick={() => void submit(prompt)} disabled={isThinking}>
              {prompt}
            </button>
          ))}
        </div>
        <form
          className="mentor-input"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="sr-only" htmlFor="mentor-question">
            Ask about your music
          </label>
          <input
            ref={inputRef}
            id="mentor-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={isThinking ? "Listening to the harmony…" : "Ask about your music…"}
            maxLength={600}
          />
          <button aria-label="Send question" disabled={!question.trim() || isThinking}>
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="mentor-note">Text guidance only · your audio stays on device</p>
      </aside>
    </>
  );
}

export function HarmonicCompassApp({ initialShowcase = false }: { initialShowcase?: boolean }) {
  const [entered, setEntered] = useState(initialShowcase);
  const [activeSpace, setActiveSpace] = useState<Space>("play");
  const [inputMode, setInputMode] = useState<InputMode>(initialShowcase ? "demo" : "idle");
  const [mentorOpen, setMentorOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveChord, setLiveChord] = useState<string | null>(null);
  const [listeningState, setListeningState] = useState<ListeningState>("idle");
  const [sessionProgression, setSessionProgression] = useState<ProgressionChord[]>(() =>
    initialShowcase ? cloneProgression(demoProgression) : [],
  );
  const [buildSections, setBuildSections] = useState<BuildSection[] | null>(null);
  const [listenNotice, setListenNotice] = useState<string | null>(null);
  const listenerRef = useRef<MicrophoneChordListener | null>(null);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      if (event instanceof CustomEvent) {
        listenerRef.current?.setPreviewActive(Boolean(event.detail));
      }
    };
    window.addEventListener("harmonic-compass-preview", handlePreview);
    return () => {
      window.removeEventListener("harmonic-compass-preview", handlePreview);
      void listenerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const preferences = JSON.parse(
          localStorage.getItem("harmonic-compass-display") ?? "{}",
        ) as {
          highContrast?: boolean;
          reducedMotion?: boolean;
        };
        setHighContrast(Boolean(preferences.highContrast));
        setReducedMotion(Boolean(preferences.reducedMotion));
      } catch {
        // Preferences are optional; inaccessible storage keeps the calm defaults.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "harmonic-compass-display",
        JSON.stringify({ highContrast, reducedMotion }),
      );
    } catch {
      // Display preferences remain available for this session when storage is unavailable.
    }
  }, [highContrast, reducedMotion]);
  const changeInputMode = (mode: InputMode) => {
    setInputMode(mode);
    if (mode !== "listening") {
      setListeningState("idle");
      void listenerRef.current?.stop();
      listenerRef.current = null;
      return;
    }
    setListeningState("requesting");
    void listenerRef.current?.stop();
    const listener = new MicrophoneChordListener({
      onConfirmed: (event) => {
        setLiveChord(formatChord(event.primary.chord));
        setListeningState("listening");
        setListenNotice(null);
      },
      onHealth: (health) => {
        setListeningState(health.state);
        if (health.message) setListenNotice(health.message);
        if (["denied", "unsupported", "error"].includes(health.state)) {
          setInputMode("idle");
        }
      },
    });
    listenerRef.current = listener;
    void listener.start();
  };

  if (!entered) {
    return (
      <Onboarding
        onListen={() => {
          setEntered(true);
          changeInputMode("listening");
        }}
        onDemo={() => {
          setEntered(true);
          changeInputMode("demo");
        }}
        onManual={() => {
          setEntered(true);
          changeInputMode("manual");
        }}
      />
    );
  }

  return (
    <div
      className={`app-shell app-shell--${activeSpace} ${highContrast ? "is-high-contrast" : ""} ${reducedMotion ? "is-reduced-motion" : ""}`}
    >
      <AppNavigation
        activeSpace={activeSpace}
        setActiveSpace={setActiveSpace}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onSettings={() => setUtilityPanel("settings")}
      />
      <div className="app-main">
        {activeSpace === "play" && (
          <PlaySpace
            inputMode={inputMode}
            setInputMode={changeInputMode}
            listeningState={listeningState}
            onMentor={() => setMentorOpen(true)}
            onMenu={() => setMobileOpen(true)}
            onProfile={() => setUtilityPanel("profile")}
            onOpenBuild={() => {
              if (sessionProgression.length === 0) return;
              setBuildSections(
                (current) => current ?? buildSectionsForProgression(sessionProgression),
              );
              setActiveSpace("build");
            }}
            liveChord={liveChord}
            capturedProgression={sessionProgression}
            setCapturedProgression={setSessionProgression}
          />
        )}
        {activeSpace === "build" && (
          <BuildSpace
            onMentor={() => setMentorOpen(true)}
            onMenu={() => setMobileOpen(true)}
            onProfile={() => setUtilityPanel("profile")}
            startingProgression={sessionProgression}
            startingSections={buildSections ?? undefined}
            sessionMode={!initialShowcase && sessionProgression.length > 0}
            onSectionsChange={setBuildSections}
          />
        )}
        {activeSpace === "grow" && (
          <GrowSpace
            onMentor={() => setMentorOpen(true)}
            onMenu={() => setMobileOpen(true)}
            onProfile={() => setUtilityPanel("profile")}
            hasSessionHistory={sessionProgression.length > 0}
          />
        )}
        {activeSpace === "library" && (
          <LibrarySpace
            onMentor={() => setMentorOpen(true)}
            onMenu={() => setMobileOpen(true)}
            onProfile={() => setUtilityPanel("profile")}
            onResume={() => setActiveSpace("build")}
          />
        )}
      </div>
      <MentorDrawer open={mentorOpen} onClose={() => setMentorOpen(false)} />
      <UtilityDrawer
        panel={utilityPanel}
        onClose={() => setUtilityPanel(null)}
        highContrast={highContrast}
        setHighContrast={setHighContrast}
        reducedMotion={reducedMotion}
        hasSessionHistory={sessionProgression.length > 0}
        setReducedMotion={setReducedMotion}
      />
      {listenNotice && (
        <div className="app-notice" role="status">
          <Mic2 size={17} />
          <p>{listenNotice}</p>
          <button
            onClick={() => {
              changeInputMode("demo");
              setListenNotice(null);
            }}
          >
            Use demo
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setListenNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
