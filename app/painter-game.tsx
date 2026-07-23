"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const COLS = 76;
const ROWS = 56;
const EMPTY = 254;
const PROTECTED = 255;
const CREATOR_COLS = 24;
const CREATOR_ROWS = 18;
const STORAGE_KEY = "pausa-painter-v1";
const COMPLETION = 92;
const BRUSH_BASE_ANGLE = 155;
const ERROR_RED = "#ef352c";

type Screen = "home" | "levels" | "play" | "creator";
type Level = {
  id: string;
  number?: number;
  name: string;
  note: string;
  colors: string[];
  desired: number[];
  custom?: boolean;
};
type CustomLevel = {
  id: string;
  name: string;
  colors: string[];
  desired: number[];
  createdAt: number;
};
type SaveData = {
  unlocked: number;
  completed: number[];
  best: Record<string, number>;
  customLevels: CustomLevel[];
};

const PALETTES = [
  ["#96A98B"],
  ["#D79A7D"],
  ["#9A9FBF"],
  ["#3F8578", "#D29A2E"],
  ["#C38D86"],
  ["#6F67A8", "#D29A2E"],
  ["#3F8578", "#8B5E8B"],
  ["#527F70", "#C47745", "#6F67A8"],
  ["#4E8EAD", "#D29A2E"],
  ["#8B5E8B", "#D29A2E", "#3F8578"],
  ["#3F8578", "#C47745", "#6F67A8"],
  ["#4E8EAD", "#D29A2E", "#8B5E8B"],
  ["#D29A2E", "#3F8578", "#6F67A8"],
  ["#66834D", "#C47745", "#6F67A8"],
  ["#4E8EAD", "#C47745"],
  ["#8B5E8B", "#3F8578", "#D29A2E"],
  ["#4E8EAD", "#C47745"],
  ["#66834D", "#C47745", "#6F67A8"],
  ["#6F67A8", "#D29A2E", "#3F8578"],
  ["#3F8578", "#C47745", "#D29A2E"],
  ["#66834D", "#8B5E8B"],
  ["#8B5E8B", "#3F8578", "#D29A2E"],
  ["#4E8EAD", "#C47745", "#D29A2E"],
  ["#3F8578", "#D29A2E", "#6F67A8"],
];

const LEVEL_INFO = [
  ["El primer trazo", "Una pared entera, sin prisa."],
  ["Alrededor", "Cuida el pequeño cuadro del centro."],
  ["Burbujas", "Tres círculos quieren quedarse limpios."],
  ["Dos mitades", "Cada lado tiene su propia calma."],
  ["La ventana", "Pinta alrededor de la luz."],
  ["Marea baja", "Sigue la curva de los dos colores."],
  ["Lunares", "Cambia de color en cada isla."],
  ["La puerta", "Tres franjas y un hueco protegido."],
  ["Mantita", "Un patrón sencillo, casilla a casilla."],
  ["Jardín lento", "Tres colores entre hojas blancas."],
  ["Terrazo", "Pequeñas formas, mucha paciencia."],
  ["Anillos", "Un mural que respira desde el centro."],
  ["Rayos de sol", "Gira alrededor de un centro protegido."],
  ["La casa de té", "Toldos, ventanas y tres tonos tranquilos."],
  ["El sendero", "Un río suave serpentea entre las piedras."],
  ["Vidriera", "Cada cristal tiene su propio color."],
  ["Nubes bajas", "Pinta el cielo y deja pasar las nubes."],
  ["La estantería", "Muchos rincones separados por madera."],
  ["Montañas", "Tres capas que se encuentran en el horizonte."],
  ["Espiral", "Sigue el giro desde fuera hacia dentro."],
  ["Jarrones", "Dos paredes y tres siluetas delicadas."],
  ["Jardín zen", "Rodea las piedras con ondas de color."],
  ["Casitas", "Una pequeña calle al caer la tarde."],
  ["El gran mural", "Todo lo aprendido, reunido con calma."],
];

const TOTAL_LEVELS = LEVEL_INFO.length;

const defaultSave: SaveData = {
  unlocked: 1,
  completed: [],
  best: {},
  customLevels: [],
};

function buildLevel(number: number): Level {
  const desired = new Array(COLS * ROWS).fill(0);
  const n = number;
  const set = (x: number, y: number, value: number) => {
    desired[y * COLS + x] = value;
  };
  const inCircle = (x: number, y: number, cx: number, cy: number, r: number) =>
    (x - cx) ** 2 + (y - cy) ** 2 < r ** 2;
  const inEllipse = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const inRect = (
    x: number,
    y: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) => x > left && x < right && y > top && y < bottom;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const nx = x / COLS;
      const ny = y / ROWS;
      if (n === 2 && x > 27 && x < 49 && y > 18 && y < 38) set(x, y, PROTECTED);
      if (
        n === 3 &&
        (inCircle(x, y, 22, 20, 8) ||
          inCircle(x, y, 52, 18, 6) ||
          inCircle(x, y, 43, 39, 9))
      )
        set(x, y, PROTECTED);
      if (n === 4) set(x, y, x < COLS / 2 ? 0 : 1);
      if (n === 5 && x > 24 && x < 53 && y > 10 && y < 43) set(x, y, PROTECTED);
      if (n === 6) set(x, y, ny < 0.48 + Math.sin(nx * Math.PI * 2) * 0.12 ? 0 : 1);
      if (n === 7) {
        const dots = [
          [18, 16, 7],
          [49, 14, 8],
          [34, 36, 9],
          [62, 39, 6],
        ];
        set(x, y, dots.some(([cx, cy, r]) => inCircle(x, y, cx, cy, r)) ? 1 : 0);
      }
      if (n === 8) {
        set(x, y, y < 18 ? 0 : y < 37 ? 1 : 2);
        if (x > 29 && x < 48 && y > 20) set(x, y, PROTECTED);
      }
      if (n === 9) set(x, y, (Math.floor(x / 13) + Math.floor(y / 11)) % 2);
      if (n === 10) {
        const leaves = [
          [17, 17, 8],
          [57, 15, 7],
          [38, 39, 9],
        ];
        const protectedLeaf = leaves.some(
          ([cx, cy, r]) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.48)) ** 2 < 1,
        );
        if (protectedLeaf) set(x, y, PROTECTED);
        else set(x, y, nx < 0.34 ? 0 : nx < 0.68 ? 1 : 2);
      }
      if (n === 11) {
        const seed = (x * 17 + y * 31 + Math.floor(x / 7) * 13) % 47;
        set(x, y, seed < 5 ? 1 : seed > 41 ? 2 : 0);
      }
      if (n === 12) {
        const d = Math.hypot(x - COLS / 2, y - ROWS / 2);
        if (d < 6) set(x, y, PROTECTED);
        else set(x, y, d < 15 ? 2 : d < 24 ? 1 : 0);
      }
      if (n === 13) {
        const dx = x - COLS / 2;
        const dy = y - ROWS / 2;
        const d = Math.hypot(dx, dy);
        if (d < 7) set(x, y, PROTECTED);
        else {
          const sector = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 12);
          set(x, y, sector % 3);
        }
      }
      if (n === 14) {
        set(x, y, y < 14 ? 1 : 0);
        if (y > 19 && y < 27) set(x, y, Math.floor(x / 8) % 2 ? 1 : 2);
        const windows =
          inRect(x, y, 9, 31, 25, 48) ||
          inRect(x, y, 51, 31, 67, 48) ||
          inRect(x, y, 31, 34, 45, 56);
        if (windows) set(x, y, PROTECTED);
      }
      if (n === 15) {
        const riverY = 28 + Math.sin(nx * Math.PI * 2.4) * 11;
        set(x, y, Math.abs(y - riverY) < 7 ? 1 : 0);
        const stones =
          inEllipse(x, y, 17, 17, 5, 3) ||
          inEllipse(x, y, 44, 35, 6, 3.5) ||
          inEllipse(x, y, 63, 18, 4.5, 3);
        if (stones) set(x, y, PROTECTED);
      }
      if (n === 16) {
        const diagonalGrid =
          Math.abs(((x + y + 100) % 18) - 9) < 1.15 ||
          Math.abs(((x - y + 100) % 18) - 9) < 1.15;
        if (diagonalGrid) set(x, y, PROTECTED);
        else set(x, y, (Math.floor((x + y) / 10) + Math.floor((x - y + 90) / 14)) % 3);
      }
      if (n === 17) {
        set(x, y, ny < 0.62 + Math.sin(nx * Math.PI * 2) * 0.06 ? 0 : 1);
        const cloud =
          inEllipse(x, y, 18, 18, 11, 4.5) ||
          inCircle(x, y, 14, 15, 5) ||
          inCircle(x, y, 22, 14, 6) ||
          inEllipse(x, y, 54, 31, 13, 5) ||
          inCircle(x, y, 49, 27, 6) ||
          inCircle(x, y, 59, 27, 7);
        if (cloud) set(x, y, PROTECTED);
      }
      if (n === 18) {
        const shelf = Math.abs(y - 18) < 1.5 || Math.abs(y - 37) < 1.5;
        const upright =
          (y < 18 && (Math.abs(x - 25) < 1.2 || Math.abs(x - 51) < 1.2)) ||
          (y > 19 && y < 37 && Math.abs(x - 38) < 1.2) ||
          (y > 38 && (Math.abs(x - 19) < 1.2 || Math.abs(x - 57) < 1.2));
        if (shelf || upright) set(x, y, PROTECTED);
        else set(x, y, (Math.floor(x / 19) + Math.floor(y / 18)) % 3);
      }
      if (n === 19) {
        const ridgeOne = 35 - Math.abs(x - 22) * 0.55;
        const ridgeTwo = 38 - Math.abs(x - 54) * 0.46;
        if (y < Math.min(ridgeOne, ridgeTwo)) set(x, y, 0);
        else if (y < Math.max(ridgeOne + 10, ridgeTwo + 8)) set(x, y, 1);
        else set(x, y, 2);
      }
      if (n === 20) {
        const dx = x - COLS / 2;
        const dy = y - ROWS / 2;
        const d = Math.hypot(dx, dy);
        const spiral = Math.floor((Math.atan2(dy, dx) + d * 0.27 + Math.PI * 5) / 1.15);
        if (d < 5) set(x, y, PROTECTED);
        else set(x, y, Math.abs(spiral) % 3);
      }
      if (n === 21) {
        set(x, y, x < COLS / 2 ? 0 : 1);
        const vaseOne =
          inEllipse(x, y, 16, 39, 8, 13) || inRect(x, y, 13, 17, 19, 30);
        const vaseTwo =
          inEllipse(x, y, 39, 35, 10, 16) || inRect(x, y, 35, 11, 43, 24);
        const vaseThree =
          inEllipse(x, y, 62, 40, 7, 11) || inRect(x, y, 59, 23, 65, 32);
        if (vaseOne || vaseTwo || vaseThree) set(x, y, PROTECTED);
      }
      if (n === 22) {
        const stoneOne = inEllipse(x, y, 24, 29, 7, 4);
        const stoneTwo = inEllipse(x, y, 53, 22, 9, 5);
        const nearest = Math.min(
          Math.hypot((x - 24) * 0.8, y - 29),
          Math.hypot((x - 53) * 0.75, y - 22),
        );
        set(x, y, Math.floor(nearest / 5) % 2);
        if (stoneOne || stoneTwo) set(x, y, PROTECTED);
      }
      if (n === 23) {
        const block = Math.floor(x / 13);
        const heights = [27, 18, 31, 22, 15, 29];
        const roof = heights[Math.min(block, heights.length - 1)];
        if (y < roof) set(x, y, 0);
        else set(x, y, block % 2 ? 1 : 2);
        const localX = x % 13;
        if (y > roof + 7 && y < roof + 13 && localX > 4 && localX < 8)
          set(x, y, PROTECTED);
        if (y > 45 && localX > 8 && localX < 12) set(x, y, PROTECTED);
      }
      if (n === 24) {
        const dx = x - COLS / 2;
        const dy = y - ROWS / 2;
        const d = Math.hypot(dx, dy);
        if (ny < 0.34) {
          set(x, y, Math.floor((Math.atan2(dy, dx) + Math.PI) / 0.8) % 3);
        } else if (nx < 0.5) {
          set(x, y, Math.floor((ny * 8 + Math.sin(nx * 13)) % 3));
        } else {
          set(x, y, Math.floor(d / 8) % 3);
        }
        const leaf =
          inEllipse(x, y, 38, 28, 6, 16) ||
          inEllipse(x, y, 31, 29, 5, 12) ||
          inEllipse(x, y, 45, 29, 5, 12);
        if (leaf) set(x, y, PROTECTED);
      }
    }
  }
  return {
    id: `level-${number}`,
    number,
    name: LEVEL_INFO[number - 1][0],
    note: LEVEL_INFO[number - 1][1],
    colors: PALETTES[number - 1],
    desired,
  };
}

const BUILT_LEVELS = Array.from(
  { length: TOTAL_LEVELS },
  (_, index) => buildLevel(index + 1),
);

function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
    const earnedUnlock = completed.length
      ? Math.min(TOTAL_LEVELS, Math.max(...completed) + 1)
      : 1;
    return {
      unlocked: Math.max(1, earnedUnlock, Number(parsed.unlocked) || 1),
      completed,
      best: parsed.best || {},
      customLevels: Array.isArray(parsed.customLevels) ? parsed.customLevels : [],
    };
  } catch {
    return defaultSave;
  }
}

function saveProgress(data: SaveData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function MiniPattern({ level }: { level: Level }) {
  const sample = Array.from({ length: 48 }, (_, i) => {
    const x = i % 8;
    const y = Math.floor(i / 8);
    const sx = Math.min(COLS - 1, Math.floor((x / 7) * (COLS - 1)));
    const sy = Math.min(ROWS - 1, Math.floor((y / 5) * (ROWS - 1)));
    return level.desired[sy * COLS + sx];
  });
  return (
    <div className="mini-pattern" aria-hidden="true">
      {sample.map((cell, i) => (
        <i
          key={i}
          style={{
            background:
              cell === PROTECTED
                ? "#f5efe5"
                : `${level.colors[cell] || level.colors[0]}55`,
          }}
        />
      ))}
    </div>
  );
}

function LeafMark() {
  return (
    <span className="leaf-mark" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export default function PainterGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSave(loadSave());
    setHydrated(true);
  }, []);

  const updateSave = useCallback((next: SaveData) => {
    setSave(next);
    saveProgress(next);
  }, []);

  const startLevel = (level: Level) => {
    setActiveLevel(level);
    setScreen("play");
  };

  const continueLevel =
    BUILT_LEVELS[Math.min(save.unlocked, BUILT_LEVELS.length) - 1];

  if (!hydrated) return <main className="app-shell loading-shell"><LeafMark /></main>;

  return (
    <main className="app-shell">
      {screen === "home" && (
        <HomeScreen
          save={save}
          continueLevel={continueLevel}
          onContinue={() => startLevel(continueLevel)}
          onLevels={() => setScreen("levels")}
          onCreator={() => setScreen("creator")}
        />
      )}
      {screen === "levels" && (
        <LevelsScreen
          save={save}
          onBack={() => setScreen("home")}
          onPlay={startLevel}
          onCreator={() => setScreen("creator")}
        />
      )}
      {screen === "creator" && (
        <CreatorScreen
          onBack={() => setScreen("home")}
          save={save}
          updateSave={updateSave}
          onPlay={startLevel}
        />
      )}
      {screen === "play" && activeLevel && (
        <PlayScreen
          key={activeLevel.id}
          level={activeLevel}
          save={save}
          updateSave={updateSave}
          onExit={() => setScreen(activeLevel.custom ? "creator" : "levels")}
          onNext={(next) => startLevel(next)}
        />
      )}
    </main>
  );
}

function HomeScreen({
  save,
  continueLevel,
  onContinue,
  onLevels,
  onCreator,
}: {
  save: SaveData;
  continueLevel: Level;
  onContinue: () => void;
  onLevels: () => void;
  onCreator: () => void;
}) {
  return (
    <section className="home-screen screen-enter">
      <header className="brand-row">
        <div className="brand"><LeafMark /> pausa</div>
        <button className="round-button" aria-label="Ver niveles" onClick={onLevels}>
          <span className="grid-icon" />
        </button>
      </header>

      <div className="home-copy">
        <p className="eyebrow">Un rincón para ti</p>
        <h1>Pinta despacio.<br /><em>Respira.</em></h1>
        <p>Llena cada pared de color, sin relojes y a tu manera.</p>
      </div>

      <div className="room-card" aria-hidden="true">
        <div className="sun-shape" />
        <div className="wall-art"><span /><span /></div>
        <div className="plant"><i /><i /><i /><b /></div>
        <div className="paint-pot"><span /></div>
        <div className="room-brush"><i /></div>
      </div>

      <div className="home-actions">
        <button className="primary-button" onClick={onContinue} data-testid="continue-level">
          <span>
            <small>{save.completed.length ? "Seguir pintando" : "Comenzar"}</small>
            Nivel {continueLevel.number} · {continueLevel.name}
          </span>
          <b aria-hidden="true">→</b>
        </button>
        <button className="soft-button" onClick={onCreator}>
          <span className="plus-icon">＋</span>
          Crear mi propio mural
        </button>
      </div>

      <p className="saved-note">Tu progreso se guarda en este dispositivo</p>
    </section>
  );
}

function LevelsScreen({
  save,
  onBack,
  onPlay,
  onCreator,
}: {
  save: SaveData;
  onBack: () => void;
  onPlay: (level: Level) => void;
  onCreator: () => void;
}) {
  return (
    <section className="levels-screen screen-enter">
      <header className="page-header">
        <button className="round-button back" onClick={onBack} aria-label="Volver">←</button>
        <div><p className="eyebrow">Tu paseo</p><h2>Niveles</h2></div>
        <span className="progress-badge">{save.completed.length}/{TOTAL_LEVELS}</span>
      </header>
      <div className="level-path">
        {BUILT_LEVELS.map((level, index) => {
          const unlocked = index + 1 <= save.unlocked;
          const done = save.completed.includes(index + 1);
          return (
            <button
              className={`level-card ${!unlocked ? "locked" : ""}`}
              key={level.id}
              disabled={!unlocked}
              onClick={() => onPlay(level)}
              aria-label={
                unlocked
                  ? `Nivel ${index + 1}: ${level.name}`
                  : `Nivel ${index + 1} bloqueado`
              }
            >
              <MiniPattern level={level} />
              <span className="level-copy">
                <small>{done ? "Completado" : `Nivel ${index + 1}`}</small>
                <strong>{level.name}</strong>
                <em>{level.note}</em>
              </span>
              <span className={`level-status ${done ? "done" : ""}`}>
                {done ? "✓" : unlocked ? "→" : "•"}
              </span>
            </button>
          );
        })}
      </div>
      <button className="creator-banner" onClick={onCreator}>
        <span className="plus-icon">＋</span>
        <span><strong>Tu propio mural</strong><small>Diseña un nivel desde cero</small></span>
        <b>→</b>
      </button>
    </section>
  );
}

function PlayScreen({
  level,
  save,
  updateSave,
  onExit,
  onNext,
}: {
  level: Level;
  save: SaveData;
  updateSave: (data: SaveData) => void;
  onExit: () => void;
  onNext: (level: Level) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef(new Uint8Array(COLS * ROWS).fill(EMPTY));
  const mistakeRef = useRef(new Uint8Array(COLS * ROWS));
  const strokeMarksRef = useRef<
    Array<{ x: number; y: number; color: number; radius: number }>
  >([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const brushScreenRef = useRef<{ left: number; top: number } | null>(null);
  const selectedRef = useRef(0);
  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [finished, setFinished] = useState(false);
  const targetCount = useMemo(
    () => Math.max(1, level.desired.filter((v) => v !== PROTECTED).length),
    [level],
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cw = w / COLS;
    const ch = h / ROWS;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#e9dfd0";
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const desired = level.desired[i];
        if (desired !== PROTECTED) {
          ctx.fillStyle = `${level.colors[desired] || level.colors[0]}34`;
          ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
        } else {
          ctx.fillStyle = "#f7f0e5";
          ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
        }
        const painted = paintRef.current[i];
        if (painted !== EMPTY) {
          const isWrong =
            mistakeRef.current[i] === 1 && painted !== desired;
          ctx.fillStyle = isWrong
            ? ERROR_RED
            : level.colors[painted] || "#c78d82";
          ctx.fillRect(x * cw - 0.6, y * ch - 0.6, cw + 1.2, ch + 1.2);
        }
      }
    }

    const recentMarks = strokeMarksRef.current.slice(-24);
    for (const mark of recentMarks) {
      const color = level.colors[mark.color] || level.colors[0];
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(
        mark.x,
        mark.y,
        mark.radius * 1.08,
        mark.radius * 0.88,
        -0.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = "#fff8ec";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(mark.x - mark.radius * 0.65, mark.y - mark.radius * 0.22);
      ctx.lineTo(mark.x + mark.radius * 0.45, mark.y - mark.radius * 0.05);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = ERROR_RED;
    ctx.strokeStyle = "#a91f1a";
    ctx.lineWidth = 0.8;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (
          mistakeRef.current[i] === 1 &&
          paintRef.current[i] !== level.desired[i]
        ) {
          ctx.fillRect(x * cw + 0.25, y * ch + 0.25, cw - 0.5, ch - 0.5);
          ctx.strokeRect(x * cw + 0.25, y * ch + 0.25, cw - 0.5, ch - 0.5);
        }
      }
    }

    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#6e665d";
    ctx.lineWidth = 1;
    for (let y = 8; y < h; y += 19) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.25, y + 2, w * 0.72, y - 2, w, y + 1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [level]);

  useEffect(() => {
    render();
  }, [render]);

  const calculateProgress = () => {
    let correct = 0;
    for (let i = 0; i < level.desired.length; i++) {
      if (
        level.desired[i] !== PROTECTED &&
        paintRef.current[i] === level.desired[i]
      )
        correct++;
    }
    const next = Math.min(100, Math.round((correct / targetCount) * 100));
    setProgress(next);
    return next;
  };

  const applyPoint = (px: number, py: number, pressure = 0.5) => {
    const gx = (px / 720) * COLS;
    const gy = (py / 530) * ROWS;
    const radius = 3.2 + pressure * 1.3;
    strokeMarksRef.current.push({
      x: px,
      y: py,
      color: selectedRef.current,
      radius: (radius / COLS) * 720,
    });
    if (strokeMarksRef.current.length > 360)
      strokeMarksRef.current.splice(0, 120);
    let newMistakes = 0;
    for (let y = Math.floor(gy - radius); y <= Math.ceil(gy + radius); y++) {
      for (let x = Math.floor(gx - radius); x <= Math.ceil(gx + radius); x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        if ((x - gx) ** 2 + (y - gy) ** 2 > radius ** 2) continue;
        const i = y * COLS + x;
        const desired = level.desired[i];
        const color = selectedRef.current;
        if (desired === color) {
          paintRef.current[i] = color;
          mistakeRef.current[i] = 0;
        } else {
          paintRef.current[i] = color;
          if (!mistakeRef.current[i]) {
            mistakeRef.current[i] = 1;
            newMistakes++;
          }
        }
      }
    }
    if (newMistakes) {
      setPenalty((p) => Math.min(100, p + newMistakes * 0.75));
      navigator.vibrate?.(8);
      canvasRef.current?.classList.add("gentle-warn");
      window.setTimeout(
        () => canvasRef.current?.classList.remove("gentle-warn"),
        180,
      );
    }
    render();
  };

  const pointerPosition = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 720,
      y: ((event.clientY - rect.top) / rect.height) * 530,
      left: event.clientX - rect.left,
      top: event.clientY - rect.top,
    };
  };

  const moveBrush = (
    left: number,
    top: number,
    visible = true,
    angle = BRUSH_BASE_ANGLE,
  ) => {
    if (!brushRef.current) return;
    brushRef.current.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(${angle}deg)`;
    brushRef.current.style.opacity = visible ? "1" : "0";
    brushScreenRef.current = { left, top };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const p = pointerPosition(event);
    lastRef.current = { x: p.x, y: p.y };
    if (brushRef.current) brushRef.current.dataset.painting = "true";
    moveBrush(p.left, p.top, true, BRUSH_BASE_ANGLE);
    applyPoint(p.x, p.y, event.pressure || 0.5);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = pointerPosition(event);
    const previousScreen = brushScreenRef.current;
    const horizontalSpeed = previousScreen ? p.left - previousScreen.left : 0;
    const angle =
      BRUSH_BASE_ANGLE +
      Math.max(-12, Math.min(12, horizontalSpeed * 1.7));
    moveBrush(p.left, p.top, true, angle);
    if (!drawingRef.current || !lastRef.current) return;
    const last = lastRef.current;
    const distance = Math.hypot(p.x - last.x, p.y - last.y);
    const steps = Math.max(1, Math.ceil(distance / 7));
    for (let i = 1; i <= steps; i++) {
      applyPoint(
        last.x + ((p.x - last.x) * i) / steps,
        last.y + ((p.y - last.y) * i) / steps,
        event.pressure || 0.5,
      );
    }
    lastRef.current = { x: p.x, y: p.y };
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (brushRef.current) brushRef.current.dataset.painting = "false";
    const current = calculateProgress();
    if (current >= COMPLETION && !finished) {
      setFinished(true);
      navigator.vibrate?.([20, 40, 20]);
      const score = Math.max(1, Math.round(100 - penalty));
      const next: SaveData = {
        ...save,
        best: { ...save.best, [level.id]: Math.max(save.best[level.id] || 0, score) },
      };
      if (level.number) {
        next.unlocked = Math.max(
          save.unlocked,
          Math.min(TOTAL_LEVELS, level.number + 1),
        );
        next.completed = Array.from(new Set([...save.completed, level.number]));
      }
      updateSave(next);
    }
  };

  const chooseColor = (index: number) => {
    selectedRef.current = index;
    setSelected(index);
  };

  const nextBuilt =
    level.number && level.number < TOTAL_LEVELS
      ? BUILT_LEVELS[level.number]
      : null;

  return (
    <section className="play-screen screen-enter">
      <header className="play-header">
        <button className="round-button back" onClick={onExit} aria-label="Salir del nivel">←</button>
        <div className="play-title">
          <small>{level.custom ? "Tu mural" : `Nivel ${level.number}`}</small>
          <strong>{level.name}</strong>
        </div>
        <div className="percent"><b>{progress}</b><span>%</span></div>
      </header>
      <div className="progress-track" aria-label={`${progress}% pintado`}>
        <i style={{ width: `${progress}%` }} />
      </div>
      <p className="level-note">{level.note}</p>

      <div className="paint-stage">
        <canvas
          ref={canvasRef}
          width={720}
          height={530}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={(e) => {
            if (!drawingRef.current) moveBrush(0, 0, false);
            else onPointerMove(e);
          }}
          aria-label="Pared para pintar. Arrastra para aplicar pintura."
        />
        <div className="floating-brush" ref={brushRef} aria-hidden="true">
          <i className="brush-cast-shadow" />
          <i className="brush-handle"><b /></i>
          <i className="brush-metal"><b /><b /></i>
          <i
            className="brush-bristles"
            style={{ "--brush-color": level.colors[selected] } as React.CSSProperties}
          >
            <b />
            <span /><span /><span /><span /><span />
          </i>
          <i
            className="brush-paint-bead"
            style={{ "--brush-color": level.colors[selected] } as React.CSSProperties}
          />
        </div>
        <span className="paint-hint">Arrastra la brocha</span>
      </div>

      <div className="play-tools">
        <div className="palette" aria-label="Colores disponibles">
          {level.colors.map((color, index) => (
            <button
              key={color}
              className={selected === index ? "selected" : ""}
              style={{ "--swatch": color } as React.CSSProperties}
              onClick={() => chooseColor(index)}
              aria-label={`Elegir color ${index + 1}`}
            >
              <i />
            </button>
          ))}
        </div>
        <div className="care-meter">
          <span>Precisión</span>
          <div>{[0, 1, 2].map((i) => <i key={i} className={penalty > (i + 1) * 22 ? "faded" : ""}>✦</i>)}</div>
        </div>
      </div>

      {finished && (
        <div className="completion-layer" role="dialog" aria-modal="true" aria-label="Nivel completado">
          <div className="completion-card">
            <div className="completion-mark"><LeafMark /></div>
            <p className="eyebrow">Pared terminada</p>
            <h2>Qué bonito<br />te ha quedado.</h2>
            <p>Has cubierto {progress}% del mural con {Math.max(1, Math.round(100 - penalty))}% de precisión.</p>
            {nextBuilt ? (
              <button className="primary-button" onClick={() => onNext(nextBuilt)}>
                <span><small>Siguiente paseo</small>Nivel {nextBuilt.number} · {nextBuilt.name}</span><b>→</b>
              </button>
            ) : (
              <button className="primary-button" onClick={onExit}>
                <span><small>Guardar el momento</small>Volver a mis niveles</span><b>✓</b>
              </button>
            )}
            <button className="text-button" onClick={onExit}>Salir al mapa</button>
          </div>
        </div>
      )}
    </section>
  );
}

function CreatorScreen({
  onBack,
  save,
  updateSave,
  onPlay,
}: {
  onBack: () => void;
  save: SaveData;
  updateSave: (data: SaveData) => void;
  onPlay: (level: Level) => void;
}) {
  const colors = ["#3F8578", "#D29A2E", "#6F67A8"];
  const [name, setName] = useState("Mi rincón");
  const [tool, setTool] = useState(0);
  const toolRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef(new Array(CREATOR_COLS * CREATOR_ROWS).fill(0));
  const drawingRef = useRef(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const renderCreator = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cw = canvas.width / CREATOR_COLS;
    const ch = canvas.height / CREATOR_ROWS;
    ctx.fillStyle = "#eee4d7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    gridRef.current.forEach((cell, i) => {
      const x = i % CREATOR_COLS;
      const y = Math.floor(i / CREATOR_COLS);
      ctx.fillStyle = cell === PROTECTED ? "#f8f2e9" : colors[cell];
      ctx.globalAlpha = cell === PROTECTED ? 1 : 0.7;
      ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
    });
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    renderCreator();
  }, [renderCreator]);

  const paintCreator = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * CREATOR_COLS);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * CREATOR_ROWS);
    if (x < 0 || y < 0 || x >= CREATOR_COLS || y >= CREATOR_ROWS) return;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const tx = x + ox;
        const ty = y + oy;
        if (tx >= 0 && ty >= 0 && tx < CREATOR_COLS && ty < CREATOR_ROWS)
          gridRef.current[ty * CREATOR_COLS + tx] = toolRef.current;
      }
    }
    renderCreator();
  };

  const selectTool = (value: number) => {
    toolRef.current = value;
    setTool(value);
  };

  const saveLevel = () => {
    const desired = new Array(COLS * ROWS).fill(0).map((_, i) => {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      const sx = Math.min(CREATOR_COLS - 1, Math.floor((x / COLS) * CREATOR_COLS));
      const sy = Math.min(CREATOR_ROWS - 1, Math.floor((y / ROWS) * CREATOR_ROWS));
      return gridRef.current[sy * CREATOR_COLS + sx];
    });
    const custom: CustomLevel = {
      id: `custom-${Date.now()}`,
      name: name.trim() || "Mi rincón",
      colors,
      desired,
      createdAt: Date.now(),
    };
    updateSave({ ...save, customLevels: [custom, ...save.customLevels] });
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1200);
  };

  const asLevel = (custom: CustomLevel): Level => ({
    ...custom,
    custom: true,
    note: "Tu diseño, pintado a tu ritmo.",
  });

  return (
    <section className="creator-screen screen-enter">
      <header className="page-header">
        <button className="round-button back" onClick={onBack} aria-label="Volver">←</button>
        <div><p className="eyebrow">Tu pequeño taller</p><h2>Crear mural</h2></div>
        <span className="creator-count">{save.customLevels.length}</span>
      </header>

      <label className="name-field">
        <span>Nombre del mural</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={28} />
      </label>

      <div className="creator-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={720}
          height={540}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawingRef.current = true;
            paintCreator(e);
          }}
          onPointerMove={(e) => drawingRef.current && paintCreator(e)}
          onPointerUp={() => (drawingRef.current = false)}
          onPointerCancel={() => (drawingRef.current = false)}
          aria-label="Lienzo para diseñar el nivel"
        />
        <span>Desliza para dibujar las zonas</span>
      </div>

      <div className="creator-tools">
        <p>Elige una zona</p>
        <div>
          {colors.map((color, index) => (
            <button
              key={color}
              className={tool === index ? "selected" : ""}
              style={{ "--swatch": color } as React.CSSProperties}
              onClick={() => selectTool(index)}
              aria-label={`Zona de color ${index + 1}`}
            ><i /></button>
          ))}
          <button
            className={`protected-tool ${tool === PROTECTED ? "selected" : ""}`}
            onClick={() => selectTool(PROTECTED)}
            aria-label="Zona protegida"
          ><i>◇</i><span>No pintar</span></button>
        </div>
      </div>

      <button className={`primary-button save-design ${savedPulse ? "saved" : ""}`} onClick={saveLevel}>
        <span><small>{savedPulse ? "Guardado en este dispositivo" : "Cuando esté listo"}</small>{savedPulse ? "Mural guardado" : "Guardar mi mural"}</span>
        <b>{savedPulse ? "✓" : "＋"}</b>
      </button>

      {save.customLevels.length > 0 && (
        <div className="my-murals">
          <p className="eyebrow">Mis murales</p>
          {save.customLevels.map((custom) => {
            const level = asLevel(custom);
            return (
              <button key={custom.id} className="custom-card" onClick={() => onPlay(level)}>
                <MiniPattern level={level} />
                <span><strong>{custom.name}</strong><small>Tocar para pintar</small></span>
                <b>→</b>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
