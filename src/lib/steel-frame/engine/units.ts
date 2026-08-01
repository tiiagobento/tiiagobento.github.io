import type {
  SteelFrameEngineDimensionKind,
  SteelFrameEngineRounding,
  SteelFrameEngineRoundingMode,
  SteelFrameEngineUnit,
} from "./types";

const unitDimensions: Record<SteelFrameEngineUnit, SteelFrameEngineDimensionKind> = {
  mm: "length",
  cm: "length",
  m: "length",
  m2: "area",
  unit: "count",
  piece: "count",
  bar: "count",
  board: "count",
  package: "count",
  roll: "count",
  box: "count",
  bag: "count",
  kg: "mass",
  liter: "volume",
};

const lengthToMeters: Partial<Record<SteelFrameEngineUnit, number>> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
};

export function getSteelFrameEngineUnitDimension(
  unit: SteelFrameEngineUnit,
): SteelFrameEngineDimensionKind {
  return unitDimensions[unit];
}

export function roundSteelFrameEngineNumber(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function assertSteelFrameEngineNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} deve ser um numero finito e nao negativo.`);
  }

  return value;
}

export function convertSteelFrameEngineLength(
  value: number,
  from: Extract<SteelFrameEngineUnit, "mm" | "cm" | "m">,
  to: Extract<SteelFrameEngineUnit, "mm" | "cm" | "m">,
): number {
  assertSteelFrameEngineNonNegative(value, "O valor de comprimento");
  return roundSteelFrameEngineNumber((value * lengthToMeters[from]!) / lengthToMeters[to]!);
}

export function convertSteelFrameEngineMeasurement(
  value: number,
  from: SteelFrameEngineUnit,
  to: SteelFrameEngineUnit,
): number {
  assertSteelFrameEngineNonNegative(value, "O valor da medida");

  if (from === to) {
    return roundSteelFrameEngineNumber(value);
  }

  if (getSteelFrameEngineUnitDimension(from) !== getSteelFrameEngineUnitDimension(to)) {
    throw new Error(`Nao e possivel converter ${from} para ${to}: unidades incompativeis.`);
  }

  if (lengthToMeters[from] && lengthToMeters[to]) {
    return convertSteelFrameEngineLength(
      value,
      from as Extract<SteelFrameEngineUnit, "mm" | "cm" | "m">,
      to as Extract<SteelFrameEngineUnit, "mm" | "cm" | "m">,
    );
  }

  throw new Error(`Nao existe conversao explicita configurada entre ${from} e ${to}.`);
}

export function applySteelFrameEngineRounding(
  value: number,
  mode: SteelFrameEngineRoundingMode,
  multiple = 1,
): SteelFrameEngineRounding {
  assertSteelFrameEngineNonNegative(value, "O valor para arredondamento");
  if (!Number.isFinite(multiple) || multiple <= 0) {
    throw new Error("O multiplo de arredondamento deve ser maior que zero.");
  }

  const normalized = value / multiple;
  const rounded =
    mode === "ceil"
      ? Math.ceil(normalized)
      : mode === "floor"
        ? Math.floor(normalized)
        : mode === "nearest"
          ? Math.round(normalized)
          : normalized;

  return {
    mode,
    multiple,
    appliedValue: roundSteelFrameEngineNumber(rounded * multiple),
  };
}
