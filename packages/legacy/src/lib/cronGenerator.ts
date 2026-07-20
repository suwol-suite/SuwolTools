export type CronFields = {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
};

export type CronPresetId =
  | "everyMinute"
  | "hourly"
  | "dailyMidnight"
  | "dailyNine"
  | "weeklyMondayNine"
  | "monthlyFirst"
  | "weekdaysNine";

export const defaultCronFields: CronFields = {
  minute: "*",
  hour: "*",
  dayOfMonth: "*",
  month: "*",
  dayOfWeek: "*",
};

export const cronPresets: Record<CronPresetId, CronFields> = {
  everyMinute: defaultCronFields,
  hourly: {
    minute: "0",
    hour: "*",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "*",
  },
  dailyMidnight: {
    minute: "0",
    hour: "0",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "*",
  },
  dailyNine: {
    minute: "0",
    hour: "9",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "*",
  },
  weeklyMondayNine: {
    minute: "0",
    hour: "9",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "1",
  },
  monthlyFirst: {
    minute: "0",
    hour: "0",
    dayOfMonth: "1",
    month: "*",
    dayOfWeek: "*",
  },
  weekdaysNine: {
    minute: "0",
    hour: "9",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "1-5",
  },
};

export function buildCronExpression(fields: CronFields): string {
  return [
    fields.minute,
    fields.hour,
    fields.dayOfMonth,
    fields.month,
    fields.dayOfWeek,
  ].join(" ");
}

export function describeCronExpression(fields: CronFields): string {
  const parts = [
    describeField("minute", fields.minute),
    describeField("hour", fields.hour),
    describeField("day of month", fields.dayOfMonth),
    describeField("month", fields.month),
    describeField("weekday", fields.dayOfWeek),
  ];

  return `Runs when ${parts.join(", ")}.`;
}

function describeField(label: string, value: string): string {
  if (value === "*") {
    return `every ${label}`;
  }

  if (value.includes("-")) {
    return `${label} is ${value}`;
  }

  return `${label} is ${value}`;
}
