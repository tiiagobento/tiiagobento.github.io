import { calculateSteelFrameEngineRule, createSteelFrameEngineContext } from "./engine";
import type {
  SteelFrameEngineCalculationContext,
  SteelFrameEngineCalculationResult,
  SteelFrameEngineOpening,
  SteelFrameEngineWall,
} from "./types";

const rafaSource = {
  name: "Metodo pratico relatado pelo Rafa",
  version: "transcricao-inicial",
  documentReference: null,
  pageReference: null,
  approvedBy: null,
};

export const rafaCalibrationFixture = {
  id: "rafa-practical-method-v1",
  title: "Metodo pratico x calculo parametrizado",
  knownParameters: {
    spacingMeters: 0.4,
    referenceWallHeightMeters: 3,
    commercialBarLengthMeters: 6,
    roundingMode: "ceil" as const,
    lowerRunsPerWall: 1,
    upperRunsPerWall: 1,
    openingTreatment: "do_not_deduct" as const,
  },
  pendingInformation: [
    "Comprimento de cada parede do levantamento original.",
    "Quantidade e tipo de encontros e cantos por parede.",
    "Template tecnico de reforco para portas e janelas.",
    "Padrao, altura e quantidade de linhas dos bloqueadores.",
    "Comprimentos reais das guias adicionais e dos recortes.",
  ],
  source: rafaSource,
} as const;

export type RafaCalibrationComparison =
  | {
      status: "pending_information";
      pendingInformation: readonly string[];
      explanation: string;
    }
  | {
      status: "calculated";
      practicalResult: SteelFrameEngineCalculationResult;
      explanation: string;
    };

export function createRafaPracticalStudRequest({
  walls,
  openings = [],
}: {
  walls: SteelFrameEngineWall[];
  openings?: SteelFrameEngineOpening[];
}) {
  return {
    rule: {
      id: "rafa-studs",
      code: "RAFA_STUDS_PRACTICAL",
      name: "Montantes - metodo pratico Rafa",
      version: "1.0.0",
      approvalStatus: "pending_validation" as const,
      source: rafaSource,
      strategy: "STUD_BY_SPACING" as const,
      technicalUnit: "piece" as const,
      purchaseUnit: "bar" as const,
      acceptedInputUnits: ["m"] as const,
      wastePercent: 0,
      roundingMode: "ceil" as const,
      roundingMultiple: 1,
      scope: { wallIds: [], openingIds: [] },
      limits: { maxWallHeightMeters: null, maxOpeningWidthMeters: null },
      parameters: {
        spacingMeters: rafaCalibrationFixture.knownParameters.spacingMeters,
        initialStudsPerWall: 1,
        endStudsPerWall: 1,
        manualExtraStuds: 0,
        commercialStock: {
          commercialBars: [
            {
              id: "rafa-bar-6m",
              label: "Barra comercial de 6,00 m",
              lengthMeters: rafaCalibrationFixture.knownParameters.commercialBarLengthMeters,
              availableQuantity: null,
            },
          ],
          kerfMeters: 0,
          reusableLeftovers: [],
          minimumReusableLeftoverMeters: 0.2,
        },
      },
    },
    context: createSteelFrameEngineContext({ walls, openings }),
  };
}

export function compareRafaPracticalMethod(
  context?: Pick<SteelFrameEngineCalculationContext, "walls" | "openings">,
): RafaCalibrationComparison {
  if (!context?.walls.length) {
    return {
      status: "pending_information",
      pendingInformation: rafaCalibrationFixture.pendingInformation,
      explanation:
        "O metodo pratico do Rafa foi registrado, mas nao pode produzir um total historico sem os comprimentos reais das paredes.",
    };
  }

  return {
    status: "calculated",
    practicalResult: calculateSteelFrameEngineRule(
      createRafaPracticalStudRequest({
        walls: context.walls,
        openings: context.openings,
      }),
    ),
    explanation:
      "O resultado usa apenas os parametros conhecidos do metodo pratico e permanece sujeito a validacao tecnica.",
  };
}

export const anaPaulaHistoricalFixture = {
  id: "ana-paula-historical-v1",
  title: "Obra Ana Paula - comparacao historica",
  documentedQuantities: {
    studs: 34,
    tracks: 10,
    glasrocBoards: 15,
    drywallBoards: 20,
    rockwoolPackages: 7,
    sandwichRoofTiles: 4,
    roofScrews: 100,
  },
  pendingInformation: [
    "Geometria original das paredes, aberturas e cobertura.",
    "Composicoes e versoes de regras usadas no levantamento original.",
    "Demais materiais citados nos documentos ainda nao disponibilizados para o motor.",
  ],
  source: {
    name: "Quantitativos historicos informados para Ana Paula",
    version: "registro-inicial",
    documentReference: null,
    pageReference: null,
    approvedBy: null,
  },
} as const;

export type AnaPaulaHistoricalItemKey = keyof typeof anaPaulaHistoricalFixture.documentedQuantities;

export type AnaPaulaHistoricalComparison = {
  key: AnaPaulaHistoricalItemKey;
  expected: number;
  calculated: number | null;
  difference: number | null;
  reason: string;
};

export function compareAnaPaulaHistoricalQuantities(
  calculated: Partial<Record<AnaPaulaHistoricalItemKey, number>>,
): AnaPaulaHistoricalComparison[] {
  return (Object.entries(anaPaulaHistoricalFixture.documentedQuantities) as Array<
    [AnaPaulaHistoricalItemKey, number]
  >).map(([key, expected]) => {
    const calculatedValue = calculated[key];
    if (calculatedValue === undefined) {
      return {
        key,
        expected,
        calculated: null,
        difference: null,
        reason: "Sem geometria ou regra historica suficiente para comparar este item.",
      };
    }

    const difference = calculatedValue - expected;
    return {
      key,
      expected,
      calculated: calculatedValue,
      difference,
      reason:
        difference === 0
          ? "Coincide com o quantitativo historico informado."
          : "A diferenca deve ser explicada pela geometria, composicao ou regra de origem antes de qualquer ajuste.",
    };
  });
}
