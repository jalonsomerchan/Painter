"use client";

import {
  Fragment,
  KeyboardEvent as ReactKeyboardEvent,
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
const ERROR_RED = "#ef352c";

type Screen = "home" | "levels" | "play" | "creator";
type DifficultyKey = "easy" | "medium" | "hard";
type BrushSizeKey = "small" | "medium" | "large";
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
  difficulty: DifficultyKey;
  brushSize: BrushSizeKey;
};

const DIFFICULTIES: Record<
  DifficultyKey,
  {
    label: string;
    completion: number;
    maxError: number;
    scoreMultiplier: number;
    note: string;
  }
> = {
  easy: {
    label: "Fácil",
    completion: 85,
    maxError: 12,
    scoreMultiplier: 0.65,
    note: "Margen generoso",
  },
  medium: {
    label: "Medio",
    completion: 92,
    maxError: 6,
    scoreMultiplier: 1,
    note: "Equilibrado",
  },
  hard: {
    label: "Difícil",
    completion: 97,
    maxError: 2,
    scoreMultiplier: 1.35,
    note: "Precisión estricta",
  },
};

const BRUSH_SIZES: Record<
  BrushSizeKey,
  { label: string; radius: number }
> = {
  small: { label: "Pequeño", radius: 2.35 },
  medium: { label: "Medio", radius: 3.65 },
  large: { label: "Grande", radius: 5.1 },
};

const CREATOR_COLORS = ["#3F8578", "#D29A2E", "#6F67A8"];

const CHAPTERS = [
  "Primeros trazos",
  "Formas y rincones",
  "Murales con ritmo",
  "Maestría tranquila",
];

function scoreKey(levelId: string, difficulty: DifficultyKey) {
  return `${levelId}:${difficulty}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBest(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, score]) =>
          key.length > 0 &&
          typeof score === "number" &&
          Number.isFinite(score),
      )
      .map(([key, score]) => [
        key,
        Math.max(0, Math.min(100, Math.round(score as number))),
      ]),
  );
}

function normalizeCustomLevels(value: unknown): CustomLevel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const colors = item.colors;
    const desired = item.desired;
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.createdAt !== "number" ||
      !Number.isFinite(item.createdAt) ||
      !Array.isArray(colors) ||
      colors.length === 0 ||
      !colors.every((color) => typeof color === "string") ||
      !Array.isArray(desired) ||
      desired.length !== COLS * ROWS ||
      !desired.some((cell) => cell !== PROTECTED) ||
      !desired.every(
        (cell) =>
          cell === PROTECTED ||
          (Number.isInteger(cell) && cell >= 0 && cell < colors.length),
      )
    )
      return [];
    return [
      {
        id: item.id,
        name: item.name,
        colors,
        desired,
        createdAt: item.createdAt,
      },
    ];
  });
}

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
  ["#397A91", "#4F9A7D", "#7967A8"],
  ["#2F7691", "#C5A23A", "#695B9F"],
  ["#3E806F", "#D0A43A", "#6670A7"],
  ["#367B91", "#5E8D58", "#8A6AA4"],
  ["#4D86A5", "#66874F", "#D1A33A"],
  ["#456F9C", "#8D6BA7", "#D0A23A"],
  ["#357D78", "#4E75A4", "#C3A244"],
  ["#3F7898", "#5D8D68", "#7564A3"],
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
  ["Aurora", "Tres cintas de luz cruzan un cielo con estrellas."],
  ["Arcos de lluvia", "Pinta cada arco y deja libre su pequeño refugio."],
  ["Panal tranquilo", "Cada celda guarda un tono; las juntas quedan limpias."],
  ["Nenúfares", "Un estanque azul con hojas que flotan despacio."],
  ["El faro", "La luz abre dos caminos sobre el mar."],
  ["Guirnalda", "Bombillas suaves cuelgan sobre una pared tranquila."],
  ["Papel plegado", "Tres planos se encuentran sobre pliegues limpios."],
  ["Música del agua", "Tres corrientes se mezclan en un dibujo orgánico."],
];

const TOTAL_LEVELS = LEVEL_INFO.length;

const defaultSave: SaveData = {
  unlocked: 1,
  completed: [],
  best: {},
  customLevels: [],
  difficulty: "medium",
  brushSize: "medium",
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
      if (n === 25) {
        const upper = 13 + Math.sin(nx * Math.PI * 2.4) * 4;
        const lower = 34 + Math.sin(nx * Math.PI * 2.4 + 1.2) * 6;
        set(x, y, y < upper ? 0 : y < lower ? 1 : 2);
        const stars =
          inCircle(x, y, 10, 8, 2.2) ||
          inCircle(x, y, 29, 17, 2.9) ||
          inCircle(x, y, 47, 8, 2) ||
          inCircle(x, y, 66, 21, 2.5) ||
          inCircle(x, y, 56, 39, 2.4);
        if (stars) set(x, y, PROTECTED);
      }
      if (n === 26) {
        const arch = Math.hypot(
          (x - COLS / 2) / 1.08,
          (y - ROWS) * 1.18,
        );
        if (arch < 10) set(x, y, PROTECTED);
        else if (arch < 22) set(x, y, 2);
        else if (arch < 36) set(x, y, 1);
        else set(x, y, 0);
      }
      if (n === 27) {
        let nearest = Infinity;
        let cellColor = 0;
        for (let row = -1; row <= 4; row++) {
          for (let col = -1; col <= 3; col++) {
            const cx = 10.5 + col * 24 + (row % 2 !== 0 ? 12 : 0);
            const cy = 9 + row * 13.5;
            const dx = (x - cx) / 10.5;
            const dy = (y - cy) / 9;
            const hexDistance = Math.max(
              Math.abs(dy),
              Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5,
            );
            if (hexDistance < nearest) {
              nearest = hexDistance;
              cellColor = ((row * 2 + col) % 3 + 3) % 3;
            }
          }
        }
        set(x, y, nearest < 0.9 ? cellColor : PROTECTED);
      }
      if (n === 28) {
        set(x, y, 0);
        const pads = [
          [13, 15, 8, 5, 1],
          [35, 12, 7, 4.5, 2],
          [59, 18, 9, 5, 1],
          [25, 39, 9, 5.5, 2],
          [54, 41, 8, 5, 1],
        ] as const;
        const pad = pads.find(([cx, cy, rx, ry]) =>
          inEllipse(x, y, cx, cy, rx, ry),
        );
        if (pad) {
          set(x, y, pad[4]);
          if (inCircle(x, y, pad[0], pad[1], 2.2))
            set(x, y, PROTECTED);
        }
      }
      if (n === 29) {
        set(x, y, y < 39 ? 0 : 1);
        const beamWidth = Math.abs(x - COLS / 2) * 0.22 + 1.5;
        const beam =
          x > 2 &&
          x < COLS - 2 &&
          y < 32 &&
          Math.abs(y - 18) < beamWidth;
        if (beam) set(x, y, 2);
        const tower = inRect(x, y, 32, 19, 44, ROWS);
        const roof = y > 12 + Math.abs(x - COLS / 2) * 1.2 && y < 20;
        if (tower || roof) set(x, y, PROTECTED);
      }
      if (n === 30) {
        set(x, y, 0);
        const bulbXs = [10, 24, 38, 52, 66];
        const cordAt = (px: number) => 16 - ((px - COLS / 2) ** 2) / 180;
        const bulbIndex = bulbXs.findIndex((cx) =>
          inEllipse(x, y, cx, cordAt(cx) + 8, 5, 7),
        );
        if (bulbIndex >= 0) set(x, y, 1 + (bulbIndex % 2));
        const wire = bulbXs.some((cx) => {
          const cordY = cordAt(cx);
          return (
            Math.abs(x - cx) < 0.8 &&
            y > cordY &&
            y < cordY + 3
          );
        });
        if (Math.abs(y - cordAt(x)) < 1.15 || wire)
          set(x, y, PROTECTED);
      }
      if (n === 31) {
        const descending = x * (ROWS / COLS);
        const ascending = ROWS - descending;
        if (
          Math.abs(y - descending) < 1.15 ||
          Math.abs(y - ascending) < 1.15 ||
          inCircle(x, y, COLS / 2, ROWS / 2, 3.2)
        ) {
          set(x, y, PROTECTED);
        } else if (y < descending && y < ascending) {
          set(x, y, 0);
        } else if (y > descending && y > ascending) {
          set(x, y, 2);
        } else {
          set(x, y, 1);
        }
      }
      if (n === 32) {
        const flowX = Math.max(3, Math.min(COLS - 4, x)) / COLS;
        const flowY = Math.max(3, Math.min(ROWS - 4, y)) / ROWS;
        const flow =
          Math.sin(flowX * Math.PI * 3.2) +
          Math.sin(flowY * Math.PI * 3.6) +
          0.55 * Math.sin((flowX + flowY) * Math.PI * 2.3);
        set(x, y, flow < -0.55 ? 0 : flow < 0.65 ? 1 : 2);
        const rests =
          inEllipse(x, y, 14, 13, 5, 3) ||
          inEllipse(x, y, 61, 14, 5, 3) ||
          inEllipse(x, y, 37, 43, 6, 3.5);
        if (rests) set(x, y, PROTECTED);
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
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const parsed = isRecord(raw) ? raw : {};
    const completed = Array.from(
      new Set(
        (Array.isArray(parsed.completed) ? parsed.completed : []).filter(
          (level): level is number =>
            Number.isInteger(level) && level >= 1 && level <= TOTAL_LEVELS,
        ),
      ),
    ).sort((a, b) => a - b);
    const earnedUnlock = completed.length
      ? Math.min(TOTAL_LEVELS, Math.max(...completed) + 1)
      : 1;
    const storedUnlock =
      typeof parsed.unlocked === "number" && Number.isInteger(parsed.unlocked)
        ? parsed.unlocked
        : 1;
    return {
      unlocked: Math.min(
        TOTAL_LEVELS,
        Math.max(1, earnedUnlock, storedUnlock),
      ),
      completed,
      best: normalizeBest(parsed.best),
      customLevels: normalizeCustomLevels(parsed.customLevels),
      difficulty:
        parsed.difficulty === "easy" || parsed.difficulty === "hard"
          ? parsed.difficulty
          : "medium",
      brushSize:
        parsed.brushSize === "small" || parsed.brushSize === "large"
          ? parsed.brushSize
          : "medium",
    };
  } catch {
    return defaultSave;
  }
}

function saveProgress(data: SaveData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function MiniPattern({ level }: { level: Level }) {
  const previewCols = 12;
  const previewRows = 9;
  const sample = Array.from(
    { length: previewCols * previewRows },
    (_, i) => {
      const x = i % previewCols;
      const y = Math.floor(i / previewCols);
      const sx = Math.floor((x / (previewCols - 1)) * (COLS - 1));
      const sy = Math.floor((y / (previewRows - 1)) * (ROWS - 1));
      return level.desired[sy * COLS + sx];
    },
  );
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
  const [creatorOrigin, setCreatorOrigin] = useState<"home" | "levels">("home");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSave(loadSave());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateSave = useCallback((next: SaveData) => {
    const persisted = saveProgress(next);
    if (persisted) setSave(next);
    return persisted;
  }, []);

  const startLevel = (level: Level) => {
    setActiveLevel(level);
    setScreen("play");
  };

  const openCreator = (origin: "home" | "levels") => {
    setCreatorOrigin(origin);
    setScreen("creator");
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
          onCreator={() => openCreator("home")}
        />
      )}
      {screen === "levels" && (
        <LevelsScreen
          save={save}
          updateSave={updateSave}
          onBack={() => setScreen("home")}
          onPlay={startLevel}
          onCreator={() => openCreator("levels")}
        />
      )}
      {screen === "creator" && (
        <CreatorScreen
          onBack={() => setScreen(creatorOrigin)}
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
  updateSave,
  onBack,
  onPlay,
  onCreator,
}: {
  save: SaveData;
  updateSave: (data: SaveData) => boolean;
  onBack: () => void;
  onPlay: (level: Level) => void;
  onCreator: () => void;
}) {
  const activeDifficulty = DIFFICULTIES[save.difficulty];
  const completedAtDifficulty = BUILT_LEVELS.filter((level) => {
    const score =
      save.best[scoreKey(level.id, save.difficulty)] ??
      (save.difficulty === "medium" ? save.best[level.id] : undefined);
    return score !== undefined;
  }).length;
  return (
    <section className="levels-screen screen-enter">
      <header className="page-header">
        <button className="round-button back" onClick={onBack} aria-label="Volver">←</button>
        <div><p className="eyebrow">Tu paseo</p><h2>Niveles</h2></div>
        <span
          className="progress-badge"
          aria-label={`${completedAtDifficulty} de ${TOTAL_LEVELS} completados en dificultad ${activeDifficulty.label.toLowerCase()}`}
        >
          {completedAtDifficulty}/{TOTAL_LEVELS}
        </span>
      </header>

      <section className="difficulty-panel" aria-label="Elegir dificultad">
        <div className="difficulty-heading">
          <span>
            <small>Dificultad</small>
            <strong>{activeDifficulty.label}</strong>
          </span>
          <p>
            {activeDifficulty.completion}% obligatorio · hasta{" "}
            {activeDifficulty.maxError}% de error
          </p>
        </div>
        <div className="difficulty-options">
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => {
            const option = DIFFICULTIES[key];
            return (
              <button
                key={key}
                className={save.difficulty === key ? "selected" : ""}
                onClick={() => updateSave({ ...save, difficulty: key })}
                aria-pressed={save.difficulty === key}
              >
                <strong>{option.label}</strong>
                <small>{option.completion}% · {option.maxError}% error</small>
              </button>
            );
          })}
        </div>
        <p className="difficulty-help">
          Tu marca combina cuánto pintas y la precisión de todos tus trazos.
        </p>
      </section>

      <div className="level-path">
        {BUILT_LEVELS.map((level, index) => {
          const unlocked = index + 1 <= save.unlocked;
          const currentKey = scoreKey(level.id, save.difficulty);
          const bestScore =
            save.best[currentKey] ??
            (save.difficulty === "medium" ? save.best[level.id] : undefined);
          return (
            <Fragment key={level.id}>
              {index % 8 === 0 && (
                <div className="chapter-label">
                  <span>Capítulo {Math.floor(index / 8) + 1}</span>
                  <strong>{CHAPTERS[Math.floor(index / 8)]}</strong>
                </div>
              )}
              <button
                className={`level-card ${!unlocked ? "locked" : ""}`}
                disabled={!unlocked}
                onClick={() => onPlay(level)}
                aria-label={
                  unlocked
                    ? `Nivel ${index + 1}: ${level.name}${
                        bestScore !== undefined
                          ? `, mejor puntuación ${bestScore}`
                          : ""
                      }`
                    : `Nivel ${index + 1} bloqueado`
                }
              >
                <MiniPattern level={level} />
                <span className="level-copy">
                  <small>
                    {bestScore !== undefined
                      ? "Completado"
                      : `Nivel ${index + 1}`}
                  </small>
                  <strong>{level.name}</strong>
                  <em>
                    {bestScore !== undefined
                      ? `Mejor en ${activeDifficulty.label.toLowerCase()}: ${bestScore}/100`
                      : level.note}
                  </em>
                </span>
                {bestScore !== undefined ? (
                  <span className="level-score">
                    <b>{bestScore}</b>
                    <small>/100</small>
                  </span>
                ) : (
                  <span className="level-status">
                    {unlocked ? "→" : "•"}
                  </span>
                )}
              </button>
            </Fragment>
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
  updateSave: (data: SaveData) => boolean;
  onExit: () => void;
  onNext: (level: Level) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef(new Uint8Array(COLS * ROWS).fill(EMPTY));
  const mistakeRef = useRef(new Uint8Array(COLS * ROWS));
  const renderFrameRef = useRef<number | null>(null);
  const drawingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const selectedRef = useRef(0);
  const penaltyRef = useRef(0);
  const warningActiveRef = useRef(false);
  const completionRef = useRef<HTMLDivElement>(null);
  const [difficultyKey] = useState<DifficultyKey>(() => save.difficulty);
  const difficulty = DIFFICULTIES[difficultyKey];
  const [selected, setSelected] = useState(0);
  const [brushSize, setBrushSize] = useState<BrushSizeKey>(save.brushSize);
  const [progress, setProgress] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [precision, setPrecision] = useState(100);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [blockedByError, setBlockedByError] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const storedScore =
    save.best[scoreKey(level.id, difficultyKey)] ??
    (difficultyKey === "medium" ? save.best[level.id] : undefined);
  const targetCount = useMemo(
    () => Math.max(1, level.desired.filter((v) => v !== PROTECTED).length),
    [level],
  );
  const requirementsMet =
    progress >= difficulty.completion && errorRate <= difficulty.maxError;
  const estimatedScore = Math.max(
    1,
    Math.round(progress * 0.5 + precision * 0.5),
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
          ctx.fillStyle = `${level.colors[desired] || level.colors[0]}70`;
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

    if (level.colors.length > 1) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(65, 61, 53, 0.48)";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          const desired = level.desired[i];
          if (desired === PROTECTED || paintRef.current[i] !== EMPTY) continue;
          if (x < COLS - 1) {
            const right = i + 1;
            const rightDesired = level.desired[right];
            if (
              rightDesired !== PROTECTED &&
              rightDesired !== desired &&
              paintRef.current[right] === EMPTY
            ) {
              ctx.moveTo((x + 1) * cw, y * ch);
              ctx.lineTo((x + 1) * cw, (y + 1) * ch);
            }
          }
          if (y < ROWS - 1) {
            const below = i + COLS;
            const belowDesired = level.desired[below];
            if (
              belowDesired !== PROTECTED &&
              belowDesired !== desired &&
              paintRef.current[below] === EMPTY
            ) {
              ctx.moveTo(x * cw, (y + 1) * ch);
              ctx.lineTo((x + 1) * cw, (y + 1) * ch);
            }
          }
        }
      }
      ctx.stroke();
      ctx.restore();
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
    return () => {
      if (renderFrameRef.current !== null)
        cancelAnimationFrame(renderFrameRef.current);
    };
  }, [render]);

  useEffect(() => {
    if (!finished) return;
    const frame = requestAnimationFrame(() => completionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [finished]);

  const calculateMetrics = useCallback(() => {
    let correct = 0;
    let errors = 0;
    for (let i = 0; i < level.desired.length; i++) {
      if (
        level.desired[i] !== PROTECTED &&
        paintRef.current[i] === level.desired[i]
      )
        correct++;
      if (
        mistakeRef.current[i] === 1 &&
        paintRef.current[i] !== level.desired[i]
      )
        errors++;
    }
    const coverage = Math.min(100, (correct / targetCount) * 100);
    const currentError = (errors / targetCount) * 100;
    setProgress(Math.floor(coverage));
    setErrorRate(Math.ceil(currentError * 10) / 10);
    return { coverage, currentError };
  }, [level, targetCount]);

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      render();
      calculateMetrics();
    });
  }, [calculateMetrics, render]);

  const applyPoint = (px: number, py: number) => {
    const gx = (px / 720) * COLS;
    const gy = (py / 530) * ROWS;
    const radius = BRUSH_SIZES[brushSize].radius;
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
      const nextPenalty = Math.min(
        100,
        penaltyRef.current +
          (newMistakes / targetCount) *
            100 *
            difficulty.scoreMultiplier,
      );
      penaltyRef.current = nextPenalty;
      setPrecision(Math.max(0, Math.round(100 - nextPenalty)));
      if (!warningActiveRef.current) {
        warningActiveRef.current = true;
        navigator.vibrate?.(8);
        canvasRef.current?.classList.add("gentle-warn");
        window.setTimeout(() => {
          canvasRef.current?.classList.remove("gentle-warn");
          warningActiveRef.current = false;
        }, 180);
      }
    }
    scheduleRender();
  };

  const pointerPosition = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 720,
      y: ((event.clientY - rect.top) / rect.height) * 530,
      left: event.clientX - rect.left,
      top: event.clientY - rect.top,
      canvasWidth: rect.width,
    };
  };

  const moveIndicator = (
    left: number,
    top: number,
    canvasWidth: number,
    visible = true,
  ) => {
    if (!indicatorRef.current) return;
    if (!visible) {
      indicatorRef.current.style.opacity = "0";
      return;
    }
    const radius = BRUSH_SIZES[brushSize].radius;
    const diameter = (radius * 2 * canvasWidth) / COLS;
    indicatorRef.current.style.width = `${diameter}px`;
    indicatorRef.current.style.height = `${diameter}px`;
    indicatorRef.current.style.transform =
      `translate3d(${left}px, ${top}px, 0) translate(-50%, -50%)`;
    indicatorRef.current.style.opacity = visible ? "1" : "0";
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      !event.isPrimary ||
      activePointerRef.current !== null ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    drawingRef.current = true;
    setResetPending(false);
    const p = pointerPosition(event);
    lastRef.current = { x: p.x, y: p.y };
    if (indicatorRef.current) indicatorRef.current.dataset.painting = "true";
    moveIndicator(
      p.left,
      p.top,
      p.canvasWidth,
      true,
    );
    applyPoint(p.x, p.y);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return;
    if (
      drawingRef.current &&
      activePointerRef.current !== event.pointerId
    )
      return;
    const p = pointerPosition(event);
    moveIndicator(
      p.left,
      p.top,
      p.canvasWidth,
      true,
    );
    if (!drawingRef.current || !lastRef.current) return;
    const last = lastRef.current;
    const distance = Math.hypot(p.x - last.x, p.y - last.y);
    const steps = Math.max(1, Math.ceil(distance / 7));
    for (let i = 1; i <= steps; i++) {
      applyPoint(
        last.x + ((p.x - last.x) * i) / steps,
        last.y + ((p.y - last.y) * i) / steps,
      );
    }
    lastRef.current = { x: p.x, y: p.y };
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (indicatorRef.current) {
      indicatorRef.current.dataset.painting = "false";
      if (event.pointerType !== "mouse")
        indicatorRef.current.style.opacity = "0";
    }
    const { coverage, currentError } = calculateMetrics();
    const hasTooManyErrors =
      coverage >= difficulty.completion &&
      currentError > difficulty.maxError;
    setBlockedByError(hasTooManyErrors);
    if (hasTooManyErrors)
      navigator.vibrate?.([12, 35, 12]);
  };

  const completeLevel = () => {
    if (finished) return;
    const { coverage, currentError } = calculateMetrics();
    if (
      coverage < difficulty.completion ||
      currentError > difficulty.maxError
    ) {
      setBlockedByError(coverage >= difficulty.completion);
      return;
    }
    const currentAccuracy = Math.max(
      0,
      Math.round(100 - penaltyRef.current),
    );
    const score = Math.max(
      1,
      Math.round(coverage * 0.5 + currentAccuracy * 0.5),
    );
    const key = scoreKey(level.id, difficultyKey);
    const previousBest =
      save.best[key] ??
      (difficultyKey === "medium" ? save.best[level.id] || 0 : 0);
    const next: SaveData = {
      ...save,
      best: {
        ...save.best,
        [key]: Math.max(previousBest, score),
      },
    };
    if (level.number) {
      next.unlocked = Math.max(
        save.unlocked,
        Math.min(TOTAL_LEVELS, level.number + 1),
      );
      next.completed = Array.from(new Set([...save.completed, level.number]));
    }
    const persisted = updateSave(next);
    setBlockedByError(false);
    setFinalScore(score);
    setIsNewBest(persisted && score > previousBest);
    setSaveFailed(!persisted);
    setFinished(true);
    navigator.vibrate?.([20, 40, 20]);
  };

  const resetLevel = () => {
    paintRef.current.fill(EMPTY);
    mistakeRef.current.fill(0);
    penaltyRef.current = 0;
    warningActiveRef.current = false;
    drawingRef.current = false;
    activePointerRef.current = null;
    lastRef.current = null;
    if (indicatorRef.current) {
      indicatorRef.current.dataset.painting = "false";
      indicatorRef.current.style.opacity = "0";
    }
    setProgress(0);
    setErrorRate(0);
    setPrecision(100);
    setFinalScore(null);
    setIsNewBest(false);
    setSaveFailed(false);
    setFinished(false);
    setBlockedByError(false);
    setResetPending(false);
    render();
  };

  const requestReset = () => {
    if (progress === 0 && errorRate === 0) {
      resetLevel();
      return;
    }
    setResetPending(true);
    navigator.vibrate?.(8);
  };

  const chooseColor = (index: number) => {
    selectedRef.current = index;
    setSelected(index);
  };

  const chooseBrushSize = (size: BrushSizeKey) => {
    setBrushSize(size);
    updateSave({ ...save, brushSize: size });
    if (indicatorRef.current) indicatorRef.current.style.opacity = "0";
  };

  const nextBuilt =
    level.number && level.number < TOTAL_LEVELS
      ? BUILT_LEVELS[level.number]
      : null;

  const trapCompletionFocus = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onExit();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
      ),
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === completionRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === completionRef.current)
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section className="play-screen screen-enter">
      <header className="play-header">
        <button className="round-button back" onClick={onExit} aria-label="Salir del nivel">←</button>
        <div className="play-title">
          <small>{level.custom ? "Tu mural" : `Nivel ${level.number}`}</small>
          <strong>{level.name}</strong>
        </div>
        <div className="play-actions">
          <button
            className="round-button reset-button"
            onClick={requestReset}
            aria-label="Reiniciar nivel"
            title="Reiniciar nivel"
          >
            ↻
          </button>
          <div className="percent"><b>{progress}</b><span>%</span></div>
        </div>
      </header>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Porcentaje pintado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="level-note">
        <p>{level.note}</p>
        <span>
          {difficulty.label} ·{" "}
          {storedScore !== undefined
            ? `Récord ${storedScore}/100`
            : difficulty.note}
        </span>
      </div>

      {resetPending && (
        <div className="reset-confirm" role="alert">
          <span>¿Reiniciar este intento?</span>
          <button onClick={() => setResetPending(false)}>Seguir</button>
          <button className="confirm" onClick={resetLevel}>Reiniciar</button>
        </div>
      )}

      <div className="paint-stage">
        <canvas
          ref={canvasRef}
          width={720}
          height={530}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
          onPointerLeave={() => {
            if (!drawingRef.current) moveIndicator(0, 0, 0, false);
          }}
          aria-label="Pared para pintar. Arrastra para aplicar pintura."
        />
        <div
          className="paint-indicator"
          ref={indicatorRef}
          style={{
            "--indicator-color": level.colors[selected],
          } as React.CSSProperties}
          aria-hidden="true"
        >
          <i className="indicator-fill" />
          <i className="indicator-ring" />
          <i className="indicator-center" />
        </div>
        <span className="paint-hint">Arrastra para pintar</span>
      </div>

      <div className="play-tools">
        <div className="tool-group">
          <span className="tool-label">Color</span>
          <div
            className="palette"
            role="group"
            aria-label="Colores disponibles"
          >
            {level.colors.map((color, index) => (
              <button
                key={color}
                className={selected === index ? "selected" : ""}
                style={{ "--swatch": color } as React.CSSProperties}
                onClick={() => chooseColor(index)}
                aria-label={`Elegir color ${index + 1}`}
                aria-pressed={selected === index}
              >
                <i />
              </button>
            ))}
          </div>
        </div>
        <div className="tool-group size-tools">
          <span className="tool-label">Tamaño</span>
          <div
            className="size-options"
            role="group"
            aria-label="Tamaño de pintura"
          >
            {(Object.keys(BRUSH_SIZES) as BrushSizeKey[]).map((key) => (
              <button
                key={key}
                className={brushSize === key ? "selected" : ""}
                onClick={() => chooseBrushSize(key)}
                aria-label={`Tamaño ${BRUSH_SIZES[key].label.toLowerCase()}`}
                aria-pressed={brushSize === key}
              >
                <i data-size={key} />
                <small>{BRUSH_SIZES[key].label}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="level-requirements" aria-label="Requisitos del nivel">
        <div className={progress >= difficulty.completion ? "met" : ""}>
          <span>Pintado</span>
          <b>{progress}%</b>
          <small>mín. {difficulty.completion}%</small>
        </div>
        <div className={errorRate <= difficulty.maxError ? "met" : "over"}>
          <span>Errores</span>
          <b>
            {Number.isInteger(errorRate)
              ? errorRate.toFixed(0)
              : errorRate.toFixed(1)}
            %
          </b>
          <small>máx. {difficulty.maxError}%</small>
        </div>
        <div className="precision-stat">
          <span>Precisión</span>
          <b>{precision}%</b>
          <small>todos los trazos</small>
        </div>
      </div>

      <button
        className="primary-button finish-level"
        onClick={completeLevel}
        disabled={!requirementsMet}
      >
        <span>
          <small>
            {requirementsMet
              ? `Puntuación estimada ${estimatedScore}/100`
              : "Cumple pintado y errores"}
          </small>
          {requirementsMet ? "Terminar nivel" : "Sigue pintando"}
        </span>
        <b aria-hidden="true">{requirementsMet ? "✓" : "○"}</b>
      </button>

      {blockedByError && (
        <div className="retry-callout" role="status">
          <span>
            <strong>Hay demasiado rojo</strong>
            Corrige las zonas de otro color o vuelve a empezar.
          </span>
          <button onClick={resetLevel}>Reiniciar</button>
        </div>
      )}

      {finished && (
        <div
          className="completion-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-title"
          onKeyDown={trapCompletionFocus}
        >
          <div
            className="completion-card"
            ref={completionRef}
            tabIndex={-1}
          >
            <div className="completion-mark"><LeafMark /></div>
            <p className="eyebrow">Pared terminada</p>
            <h2 id="completion-title">Qué bonito<br />te ha quedado.</h2>
            <p>
              Has cubierto {progress}% del mural en dificultad{" "}
              {difficulty.label.toLowerCase()}, con una puntuación de{" "}
              {finalScore || 1}/100.
            </p>
            <div className="completion-record">
              <span>
                {saveFailed
                  ? "No se pudo guardar"
                  : isNewBest
                    ? "Nuevo récord"
                    : "Mejor marca"}
              </span>
              <strong>
                {saveFailed
                  ? finalScore || 1
                  : Math.max(storedScore || 0, finalScore || 1)}
                /100
              </strong>
            </div>
            {nextBuilt && !saveFailed ? (
              <button className="primary-button" onClick={() => onNext(nextBuilt)}>
                <span><small>Siguiente paseo</small>Nivel {nextBuilt.number} · {nextBuilt.name}</span><b>→</b>
              </button>
            ) : (
              <button className="primary-button" onClick={onExit}>
                <span>
                  <small>
                    {saveFailed
                      ? "Este intento no se guardó"
                      : level.custom
                        ? "Tu mural está guardado"
                        : "Guardar el momento"}
                  </small>
                  {level.custom ? "Volver a mis murales" : "Volver a mis niveles"}
                </span>
                <b>✓</b>
              </button>
            )}
            <div className="completion-links">
              <button className="text-button" onClick={resetLevel}>
                ↻ Repetir para mejorar
              </button>
              <button className="text-button" onClick={onExit}>
                {level.custom ? "Salir al taller" : "Salir al mapa"}
              </button>
            </div>
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
  updateSave: (data: SaveData) => boolean;
  onPlay: (level: Level) => void;
}) {
  const [name, setName] = useState("Mi rincón");
  const [tool, setTool] = useState(0);
  const toolRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef(new Array(CREATOR_COLS * CREATOR_ROWS).fill(0));
  const drawingRef = useRef(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);

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
      ctx.fillStyle = cell === PROTECTED ? "#f8f2e9" : CREATOR_COLORS[cell];
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
    if (toolRef.current !== PROTECTED) setCreatorError(null);
    renderCreator();
  };

  const selectTool = (value: number) => {
    toolRef.current = value;
    setTool(value);
  };

  const saveLevel = () => {
    if (gridRef.current.every((cell) => cell === PROTECTED)) {
      setCreatorError("Añade al menos una zona de color para poder jugar.");
      return;
    }
    const desired = new Array(COLS * ROWS).fill(0).map((_, i) => {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      const sx = Math.min(CREATOR_COLS - 1, Math.floor((x / COLS) * CREATOR_COLS));
      const sy = Math.min(CREATOR_ROWS - 1, Math.floor((y / ROWS) * CREATOR_ROWS));
      return gridRef.current[sy * CREATOR_COLS + sx];
    });
    const createdAt = Date.now();
    const custom: CustomLevel = {
      id: `custom-${createdAt}`,
      name: name.trim() || "Mi rincón",
      colors: [...CREATOR_COLORS],
      desired,
      createdAt,
    };
    const persisted = updateSave({
      ...save,
      customLevels: [custom, ...save.customLevels],
    });
    if (persisted) {
      setCreatorError(null);
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1200);
    } else {
      setCreatorError("No se pudo guardar en este dispositivo.");
    }
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
          {CREATOR_COLORS.map((color, index) => (
            <button
              key={color}
              className={tool === index ? "selected" : ""}
              style={{ "--swatch": color } as React.CSSProperties}
              onClick={() => selectTool(index)}
              aria-label={`Zona de color ${index + 1}`}
              aria-pressed={tool === index}
            ><i /></button>
          ))}
          <button
            className={`protected-tool ${tool === PROTECTED ? "selected" : ""}`}
            onClick={() => selectTool(PROTECTED)}
            aria-label="Zona protegida"
            aria-pressed={tool === PROTECTED}
          ><i>◇</i><span>No pintar</span></button>
        </div>
      </div>

      {creatorError && (
        <p className="creator-error" role="alert">{creatorError}</p>
      )}

      <button className={`primary-button save-design ${savedPulse ? "saved" : ""}`} onClick={saveLevel}>
        <span><small>{savedPulse ? "Guardado en este dispositivo" : "Cuando esté listo"}</small>{savedPulse ? "Mural guardado" : "Guardar mi mural"}</span>
        <b>{savedPulse ? "✓" : "＋"}</b>
      </button>

      {save.customLevels.length > 0 && (
        <div className="my-murals">
          <p className="eyebrow">Mis murales</p>
          {save.customLevels.map((custom) => {
            const level = asLevel(custom);
            const bestScore =
              save.best[scoreKey(custom.id, save.difficulty)] ??
              (save.difficulty === "medium"
                ? save.best[custom.id]
                : undefined);
            return (
              <button key={custom.id} className="custom-card" onClick={() => onPlay(level)}>
                <MiniPattern level={level} />
                <span>
                  <strong>{custom.name}</strong>
                  <small>
                    {bestScore !== undefined
                      ? `Mejor en ${DIFFICULTIES[save.difficulty].label.toLowerCase()}: ${bestScore}/100`
                      : "Tocar para pintar"}
                  </small>
                </span>
                {bestScore !== undefined ? (
                  <span className="level-score custom-score">
                    <b>{bestScore}</b><small>/100</small>
                  </span>
                ) : (
                  <b>→</b>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
