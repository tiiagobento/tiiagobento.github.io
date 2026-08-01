import { steelFrameEngineCuttingPlanInputSchema } from "./schemas";
import type {
  SteelFrameEngineCommercialBar,
  SteelFrameEngineCutBar,
  SteelFrameEngineCutPattern,
  SteelFrameEngineCuttingPlan,
  SteelFrameEngineReusableLeftover,
  SteelFrameEngineTechnicalPiece,
} from "./types";
import { roundSteelFrameEngineNumber } from "./units";

type ExpandedPiece = {
  pieceId: string;
  label: string;
  lengthMeters: number;
};

type MutableCutBar = Omit<SteelFrameEngineCutBar, "usedLengthMeters" | "kerfLossMeters" | "leftoverMeters" | "reusableLeftover">;

function compareText(first: string, second: string): number {
  return first.localeCompare(second, "en");
}

function expandPieces(pieces: SteelFrameEngineTechnicalPiece[]): ExpandedPiece[] {
  return pieces
    .flatMap((piece) =>
      Array.from({ length: piece.quantity }, (_, index) => ({
        pieceId: `${piece.id}#${index + 1}`,
        label: piece.label,
        lengthMeters: piece.lengthMeters,
      })),
    )
    .sort(
      (first, second) =>
        second.lengthMeters - first.lengthMeters ||
        compareText(first.label, second.label) ||
        compareText(first.pieceId, second.pieceId),
    );
}

function getUsedLength(bar: MutableCutBar, kerfMeters: number): number {
  const piecesLength = bar.placements.reduce((total, placement) => total + placement.lengthMeters, 0);
  const kerfLoss = Math.max(0, bar.placements.length - 1) * kerfMeters;
  return piecesLength + kerfLoss;
}

function canPlacePiece(bar: MutableCutBar, piece: ExpandedPiece, kerfMeters: number): boolean {
  const extraKerf = bar.placements.length > 0 ? kerfMeters : 0;
  return getUsedLength(bar, kerfMeters) + extraKerf + piece.lengthMeters <= bar.lengthMeters + Number.EPSILON;
}

function remainingAfterPlacement(
  bar: MutableCutBar,
  piece: ExpandedPiece,
  kerfMeters: number,
): number {
  const extraKerf = bar.placements.length > 0 ? kerfMeters : 0;
  return roundSteelFrameEngineNumber(
    bar.lengthMeters - getUsedLength(bar, kerfMeters) - extraKerf - piece.lengthMeters,
  );
}

function createCommercialBar(stock: SteelFrameEngineCommercialBar, index: number): MutableCutBar {
  return {
    id: `commercial:${stock.id}:${index}`,
    sourceType: "commercial",
    sourceId: stock.id,
    sourceLabel: stock.label,
    lengthMeters: stock.lengthMeters,
    placements: [],
  };
}

function createReusableBar(leftover: SteelFrameEngineReusableLeftover): MutableCutBar {
  return {
    id: `leftover:${leftover.id}`,
    sourceType: "leftover",
    sourceId: leftover.id,
    sourceLabel: leftover.label,
    lengthMeters: leftover.lengthMeters,
    placements: [],
  };
}

function selectOpenBar(
  bars: MutableCutBar[],
  piece: ExpandedPiece,
  kerfMeters: number,
): MutableCutBar | null {
  const candidates = bars.filter((bar) => canPlacePiece(bar, piece, kerfMeters));
  if (!candidates.length) {
    return null;
  }

  return candidates.sort(
    (first, second) =>
      remainingAfterPlacement(first, piece, kerfMeters) -
        remainingAfterPlacement(second, piece, kerfMeters) ||
      (first.sourceType === "leftover" ? 0 : 1) - (second.sourceType === "leftover" ? 0 : 1) ||
      compareText(first.id, second.id),
  )[0];
}

function selectCommercialStock(
  stocks: SteelFrameEngineCommercialBar[],
  openedByStock: Map<string, number>,
  piece: ExpandedPiece,
): SteelFrameEngineCommercialBar | null {
  const eligible = stocks.filter((stock) => {
    const opened = openedByStock.get(stock.id) ?? 0;
    const capacityAvailable = stock.availableQuantity === null || opened < stock.availableQuantity;
    return capacityAvailable && stock.lengthMeters + Number.EPSILON >= piece.lengthMeters;
  });

  if (!eligible.length) {
    return null;
  }

  return eligible.sort(
    (first, second) =>
      first.lengthMeters - piece.lengthMeters - (second.lengthMeters - piece.lengthMeters) ||
      first.lengthMeters - second.lengthMeters ||
      compareText(first.label, second.label) ||
      compareText(first.id, second.id),
  )[0];
}

function createCutPatterns(bars: SteelFrameEngineCutBar[]): SteelFrameEngineCutPattern[] {
  const patterns = new Map<string, SteelFrameEngineCutPattern>();

  bars.forEach((bar) => {
    const pieceLengthsMeters = bar.placements
      .map((placement) => placement.lengthMeters)
      .sort((first, second) => second - first);
    const key = `${bar.sourceLabel}|${pieceLengthsMeters.join(",")}`;
    const existing = patterns.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    patterns.set(key, {
      stockLabel: bar.sourceLabel,
      pieceLengthsMeters,
      count: 1,
    });
  });

  return [...patterns.values()].sort(
    (first, second) =>
      compareText(first.stockLabel, second.stockLabel) ||
      compareText(first.pieceLengthsMeters.join(","), second.pieceLengthsMeters.join(",")),
  );
}

export function calculateSteelFrameCuttingPlan(input: unknown): SteelFrameEngineCuttingPlan {
  const parsed = steelFrameEngineCuttingPlanInputSchema.parse(input);
  const pieces = expandPieces(parsed.pieces);
  const stocks = [...parsed.commercialBars].sort(
    (first, second) =>
      first.lengthMeters - second.lengthMeters ||
      compareText(first.label, second.label) ||
      compareText(first.id, second.id),
  );
  const bars: MutableCutBar[] = [...parsed.reusableLeftovers]
    .sort((first, second) => first.lengthMeters - second.lengthMeters || compareText(first.id, second.id))
    .map(createReusableBar);
  const openedByStock = new Map<string, number>();

  pieces.forEach((piece) => {
    const existingBar = selectOpenBar(bars, piece, parsed.kerfMeters);
    if (existingBar) {
      existingBar.placements.push(piece);
      return;
    }

    const stock = selectCommercialStock(stocks, openedByStock, piece);
    if (!stock) {
      throw new Error(
        `Nenhuma barra comercial ou sobra reutilizavel comporta a peca ${piece.label} de ${piece.lengthMeters} m.`,
      );
    }

    const index = (openedByStock.get(stock.id) ?? 0) + 1;
    openedByStock.set(stock.id, index);
    const bar = createCommercialBar(stock, index);
    bar.placements.push(piece);
    bars.push(bar);
  });

  const usedBars = bars
    .filter((bar) => bar.placements.length > 0)
    .map<SteelFrameEngineCutBar>((bar) => {
      const usedLengthMeters = roundSteelFrameEngineNumber(getUsedLength(bar, parsed.kerfMeters));
      const kerfLossMeters = roundSteelFrameEngineNumber(
        Math.max(0, bar.placements.length - 1) * parsed.kerfMeters,
      );
      const leftoverMeters = roundSteelFrameEngineNumber(Math.max(0, bar.lengthMeters - usedLengthMeters));

      return {
        ...bar,
        usedLengthMeters,
        kerfLossMeters,
        leftoverMeters,
        reusableLeftover: leftoverMeters >= parsed.minimumReusableLeftoverMeters,
      };
    })
    .sort((first, second) => compareText(first.id, second.id));

  const totalRequiredPieceLengthMeters = roundSteelFrameEngineNumber(
    pieces.reduce((total, piece) => total + piece.lengthMeters, 0),
  );
  const totalCommercialLengthMeters = roundSteelFrameEngineNumber(
    usedBars.reduce((total, bar) => total + bar.lengthMeters, 0),
  );
  const totalKerfLossMeters = roundSteelFrameEngineNumber(
    usedBars.reduce((total, bar) => total + bar.kerfLossMeters, 0),
  );
  const totalLeftoverMeters = roundSteelFrameEngineNumber(
    usedBars.reduce((total, bar) => total + bar.leftoverMeters, 0),
  );
  const commercialBarsByStock = stocks
    .map((stock) => ({
      stockId: stock.id,
      stockLabel: stock.label,
      quantity: usedBars.filter(
        (bar) => bar.sourceType === "commercial" && bar.sourceId === stock.id,
      ).length,
    }))
    .filter((entry) => entry.quantity > 0);
  const reusableLeftovers = usedBars
    .filter((bar) => bar.reusableLeftover && bar.leftoverMeters > 0)
    .map<SteelFrameEngineReusableLeftover>((bar) => ({
      id: `planned:${bar.id}`,
      label: `Sobra de ${bar.sourceLabel}`,
      lengthMeters: bar.leftoverMeters,
      source: bar.id,
    }));

  return {
    bars: usedBars,
    commercialBarsToPurchase: usedBars.filter((bar) => bar.sourceType === "commercial").length,
    commercialBarsByStock,
    totalRequiredPieceLengthMeters,
    totalCommercialLengthMeters,
    totalKerfLossMeters,
    totalLeftoverMeters,
    utilizationPercent:
      totalCommercialLengthMeters === 0
        ? 0
        : roundSteelFrameEngineNumber(
            ((totalRequiredPieceLengthMeters + totalKerfLossMeters) / totalCommercialLengthMeters) * 100,
          ),
    cutPatterns: createCutPatterns(usedBars),
    reusableLeftovers,
  };
}
