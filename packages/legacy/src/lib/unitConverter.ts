export type UnitGroup = "general" | "developer";

export type UnitCategory =
  | "length"
  | "area"
  | "volume"
  | "weight"
  | "temperature"
  | "speed"
  | "time"
  | "pressure"
  | "energy"
  | "power"
  | "angle"
  | "fuelEconomy"
  | "data"
  | "cssLength"
  | "developerTime"
  | "unixTimestamp";

export type UnitDefinition = {
  id: string;
  labelKey: string;
  factor?: number;
};

export type UnitCategoryDefinition = {
  id: UnitCategory;
  labelKey: string;
  group: UnitGroup;
  units: UnitDefinition[];
  noteKey?: string;
  customConvert?: (
    value: number,
    fromUnitId: string,
    toUnitId: string,
    options: UnitConversionOptions,
  ) => number;
};

export type UnitConversionOptions = {
  cssBaseFontSize?: number;
};

const metricHorsepowerInWatts = 735.49875;
const mileInKilometers = 1.609344;
const usGallonInLiters = 3.785411784;
const ukGallonInLiters = 4.54609;
const secondInMs = 1000;
const minuteInMs = 60 * secondInMs;
const hourInMs = 60 * minuteInMs;
const dayInMs = 24 * hourInMs;

function unit(id: string, factor?: number): UnitDefinition {
  return {
    id,
    labelKey: `tools.unitConverter.unit.${id}`,
    factor,
  };
}

export const unitCategories: UnitCategoryDefinition[] = [
  {
    id: "length",
    labelKey: "tools.unitConverter.category.length",
    group: "general",
    units: [
      unit("mm", 0.001),
      unit("cm", 0.01),
      unit("m", 1),
      unit("km", 1000),
      unit("inch", 0.0254),
      unit("ft", 0.3048),
      unit("yd", 0.9144),
      unit("mile", 1609.344),
    ],
  },
  {
    id: "area",
    labelKey: "tools.unitConverter.category.area",
    group: "general",
    units: [
      unit("mm2", 0.000001),
      unit("cm2", 0.0001),
      unit("m2", 1),
      unit("km2", 1_000_000),
      unit("hectare", 10_000),
      unit("acre", 4046.8564224),
      unit("pyeong", 3.305785),
    ],
  },
  {
    id: "volume",
    labelKey: "tools.unitConverter.category.volume",
    group: "general",
    units: [
      unit("ml", 0.001),
      unit("l", 1),
      unit("cm3", 0.001),
      unit("m3", 1000),
      unit("teaspoon", 0.00492892159375),
      unit("tablespoon", 0.01478676478125),
      unit("cup", 0.2365882365),
      unit("pint", 0.473176473),
      unit("quart", 0.946352946),
      unit("gallon", 3.785411784),
    ],
    noteKey: "tools.unitConverter.note.usVolume",
  },
  {
    id: "weight",
    labelKey: "tools.unitConverter.category.weight",
    group: "general",
    units: [
      unit("mg", 0.000001),
      unit("g", 0.001),
      unit("kg", 1),
      unit("ton", 1000),
      unit("oz", 0.028349523125),
      unit("lb", 0.45359237),
    ],
  },
  {
    id: "temperature",
    labelKey: "tools.unitConverter.category.temperature",
    group: "general",
    units: [unit("celsius"), unit("fahrenheit"), unit("kelvin")],
    customConvert: (value, fromUnitId, toUnitId) =>
      fromCelsius(toCelsius(value, fromUnitId), toUnitId),
  },
  {
    id: "speed",
    labelKey: "tools.unitConverter.category.speed",
    group: "general",
    units: [
      unit("meterPerSecond", 1),
      unit("kilometerPerHour", 1000 / 3600),
      unit("milePerHour", 0.44704),
      unit("knot", 0.5144444444444445),
    ],
  },
  {
    id: "time",
    labelKey: "tools.unitConverter.category.time",
    group: "general",
    units: [
      unit("millisecond", 0.001),
      unit("second", 1),
      unit("minute", 60),
      unit("hour", 3600),
      unit("day", 86_400),
      unit("week", 604_800),
      unit("month", 2_592_000),
      unit("year", 31_536_000),
    ],
    noteKey: "tools.unitConverter.note.fixedMonthYear",
  },
  {
    id: "pressure",
    labelKey: "tools.unitConverter.category.pressure",
    group: "general",
    units: [
      unit("pa", 1),
      unit("kpa", 1000),
      unit("mpa", 1_000_000),
      unit("bar", 100_000),
      unit("atm", 101_325),
      unit("psi", 6894.757293168),
      unit("mmhg", 133.322387415),
    ],
  },
  {
    id: "energy",
    labelKey: "tools.unitConverter.category.energy",
    group: "general",
    units: [
      unit("j", 1),
      unit("kj", 1000),
      unit("cal", 4.184),
      unit("kcal", 4184),
      unit("wh", 3600),
      unit("kwh", 3_600_000),
    ],
  },
  {
    id: "power",
    labelKey: "tools.unitConverter.category.power",
    group: "general",
    units: [
      unit("w", 1),
      unit("kw", 1000),
      unit("mw", 1_000_000),
      unit("hp", metricHorsepowerInWatts),
    ],
  },
  {
    id: "angle",
    labelKey: "tools.unitConverter.category.angle",
    group: "general",
    units: [
      unit("degree", Math.PI / 180),
      unit("radian", 1),
      unit("gradian", Math.PI / 200),
      unit("turn", Math.PI * 2),
    ],
  },
  {
    id: "fuelEconomy",
    labelKey: "tools.unitConverter.category.fuelEconomy",
    group: "general",
    units: [
      unit("kilometerPerLiter"),
      unit("literPer100Kilometer"),
      unit("mpgUs"),
      unit("mpgUk"),
    ],
    customConvert: convertFuelEconomy,
  },
  {
    id: "data",
    labelKey: "tools.unitConverter.category.data",
    group: "developer",
    units: [
      unit("bit", 1),
      unit("byte", 8),
      unit("kb", 8_000),
      unit("mb", 8_000_000),
      unit("gb", 8_000_000_000),
      unit("tb", 8_000_000_000_000),
      unit("kib", 8 * 1024),
      unit("mib", 8 * 1024 ** 2),
      unit("gib", 8 * 1024 ** 3),
      unit("tib", 8 * 1024 ** 4),
    ],
    noteKey: "tools.unitConverter.note.dataSize",
  },
  {
    id: "cssLength",
    labelKey: "tools.unitConverter.category.cssLength",
    group: "developer",
    units: [unit("px"), unit("rem"), unit("em"), unit("pt")],
    noteKey: "tools.unitConverter.note.cssLength",
    customConvert: convertCssLength,
  },
  {
    id: "developerTime",
    labelKey: "tools.unitConverter.category.developerTime",
    group: "developer",
    units: [
      unit("devMs", 1),
      unit("devSecond", secondInMs),
      unit("devMinute", minuteInMs),
      unit("devHour", hourInMs),
      unit("devDay", dayInMs),
    ],
  },
  {
    id: "unixTimestamp",
    labelKey: "tools.unitConverter.category.unixTimestamp",
    group: "developer",
    units: [],
  },
];

export const unitCategoryMap = unitCategories.reduce(
  (map, category) => {
    map[category.id] = category;
    return map;
  },
  {} as Record<UnitCategory, UnitCategoryDefinition>,
);

export const unitDefinitions = unitCategoryMap;

function findUnit(category: UnitCategoryDefinition, unitId: string): UnitDefinition {
  const foundUnit = category.units.find((candidate) => candidate.id === unitId);

  if (!foundUnit) {
    throw new Error("unknown-unit");
  }

  return foundUnit;
}

function toCelsius(value: number, fromUnit: string): number {
  switch (fromUnit) {
    case "celsius":
      return value;
    case "fahrenheit":
      return (value - 32) * (5 / 9);
    case "kelvin":
      return value - 273.15;
    default:
      throw new Error("unknown-unit");
  }
}

function fromCelsius(value: number, toUnit: string): number {
  switch (toUnit) {
    case "celsius":
      return value;
    case "fahrenheit":
      return value * (9 / 5) + 32;
    case "kelvin":
      return value + 273.15;
    default:
      throw new Error("unknown-unit");
  }
}

function toKilometersPerLiter(value: number, fromUnitId: string): number {
  if (value <= 0) {
    throw new Error("invalid-conversion");
  }

  switch (fromUnitId) {
    case "kilometerPerLiter":
      return value;
    case "literPer100Kilometer":
      return 100 / value;
    case "mpgUs":
      return value * (mileInKilometers / usGallonInLiters);
    case "mpgUk":
      return value * (mileInKilometers / ukGallonInLiters);
    default:
      throw new Error("unknown-unit");
  }
}

function fromKilometersPerLiter(value: number, toUnitId: string): number {
  switch (toUnitId) {
    case "kilometerPerLiter":
      return value;
    case "literPer100Kilometer":
      return 100 / value;
    case "mpgUs":
      return value / (mileInKilometers / usGallonInLiters);
    case "mpgUk":
      return value / (mileInKilometers / ukGallonInLiters);
    default:
      throw new Error("unknown-unit");
  }
}

function convertFuelEconomy(value: number, fromUnitId: string, toUnitId: string): number {
  return fromKilometersPerLiter(toKilometersPerLiter(value, fromUnitId), toUnitId);
}

function getCssLengthFactor(unitId: string, baseFontSize: number): number {
  if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
    throw new Error("invalid-conversion");
  }

  switch (unitId) {
    case "px":
      return 1;
    case "rem":
    case "em":
      return baseFontSize;
    case "pt":
      return 4 / 3;
    default:
      throw new Error("unknown-unit");
  }
}

function convertCssLength(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  options: UnitConversionOptions,
): number {
  const baseFontSize = options.cssBaseFontSize ?? 16;
  const fromFactor = getCssLengthFactor(fromUnitId, baseFontSize);
  const toFactor = getCssLengthFactor(toUnitId, baseFontSize);

  return (value * fromFactor) / toFactor;
}

function roundValue(value: number, precision: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("invalid-number");
  }

  const fixed = value.toFixed(Math.max(0, Math.min(12, precision)));
  return fixed.replace(/\.?0+$/, "");
}

export function convertUnitValue(
  categoryId: UnitCategory,
  value: number,
  fromUnitId: string,
  toUnitId: string,
  precision: number,
  options: UnitConversionOptions = {},
): string {
  if (!Number.isFinite(value)) {
    throw new Error("invalid-number");
  }

  const category = unitCategoryMap[categoryId];

  if (!category) {
    throw new Error("unknown-category");
  }

  if (category.customConvert) {
    return roundValue(
      category.customConvert(value, fromUnitId, toUnitId, options),
      precision,
    );
  }

  const fromUnit = findUnit(category, fromUnitId);
  const toUnit = findUnit(category, toUnitId);

  if (!fromUnit.factor || !toUnit.factor) {
    throw new Error("unknown-unit");
  }

  return roundValue((value * fromUnit.factor) / toUnit.factor, precision);
}
