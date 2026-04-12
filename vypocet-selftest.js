const assert = require("assert/strict");

const DEFAULT_CONFIG = {
  commRate: 30,
  baseFull: 1000,
  baseHalf: 500,
};

const CONSTANTS = {
  minTrzbaPerKm: 15,
  iacKmPerRide: 33,
  shkmKmPerRide: 7,
};

const baseValues = {
  driver: "Test",
  shift: "den",
  rz: "1BU0299",
  kmStart: 1000,
  kmEnd: 1100,
  trzba: 0,
  pristavne: 0,
  palivo: 0,
  myti: 0,
  kartou: 0,
  fakturou: 0,
  jine: 0,
  iacCount: 0,
  shkmCount: 0,
};

function roundMoney(value) {
  return Math.round(Number(value) || 0);
}

function computeMetrics(overrides, config = DEFAULT_CONFIG) {
  const values = { ...baseValues, ...overrides };
  const kmReal = Math.max(0, values.kmEnd - values.kmStart);
  const iacKm = values.iacCount * CONSTANTS.iacKmPerRide;
  const shkmKm = values.shkmCount * CONSTANTS.shkmKmPerRide;
  const invoiceKm = iacKm + shkmKm;
  const chargedKm = Math.max(0, kmReal - invoiceKm);
  const minTrzba = chargedKm * CONSTANTS.minTrzbaPerKm;
  const netto = values.trzba - values.pristavne;
  const nonCash = values.kartou + values.fakturou;
  const costs = values.palivo + values.myti + values.jine;
  const isHalf = values.shift === "pul";
  const commissionRate = config.commRate / 100;
  const fixedPayout = isHalf ? config.baseHalf : config.baseFull;
  const threshold = commissionRate > 0 ? fixedPayout / commissionRate : Number.POSITIVE_INFINITY;
  const usesPercentage = netto > threshold;
  const vyplata = netto > 0 ? roundMoney(usesPercentage ? netto * commissionRate : fixedPayout) : 0;
  const doplatek = Math.max(0, minTrzba - values.trzba);
  const delta = values.trzba - minTrzba;
  const kOdevzdani = values.trzba - values.palivo - values.myti - values.kartou - values.fakturou - values.jine - vyplata;
  const settlement = kOdevzdani + doplatek;

  return {
    ...values,
    kmReal,
    chargedKm,
    invoiceKm,
    minTrzba,
    netto,
    nonCash,
    costs,
    usesPercentage,
    vyplata,
    doplatek,
    delta,
    kOdevzdani,
    settlement,
  };
}

function runCase(name, overrides, expected, config) {
  const actual = computeMetrics(overrides, config);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${name}: ${key}`);
  }
}

runCase("plna smena fix", { trzba: 3000 }, {
  usesPercentage: false,
  vyplata: 1000,
  doplatek: 0,
  kOdevzdani: 2000,
  settlement: 2000,
});

runCase("plna smena provize", { trzba: 4000 }, {
  usesPercentage: true,
  vyplata: 1200,
  kOdevzdani: 2800,
  settlement: 2800,
});

runCase("pul smena fix", { shift: "pul", trzba: 1200 }, {
  usesPercentage: false,
  vyplata: 500,
  kOdevzdani: 700,
});

runCase("doplatek do minima", { trzba: 1000 }, {
  minTrzba: 1500,
  doplatek: 500,
  kOdevzdani: 0,
  settlement: 500,
});

runCase("smluvni km snizi minimum", { trzba: 1000, iacCount: 2, shkmCount: 1 }, {
  invoiceKm: 73,
  chargedKm: 27,
  minTrzba: 405,
  doplatek: 0,
});

runCase("pristavne snizi jen provizni zaklad", { trzba: 4000, pristavne: 1000 }, {
  netto: 3000,
  usesPercentage: false,
  vyplata: 1000,
  kOdevzdani: 3000,
  settlement: 3000,
});

runCase("nulovy fix zustava platny", { trzba: 2000 }, {
  usesPercentage: true,
  vyplata: 600,
  kOdevzdani: 1400,
}, { commRate: 30, baseFull: 0, baseHalf: 0 });

console.log("Vypocetni self-testy prosly.");
