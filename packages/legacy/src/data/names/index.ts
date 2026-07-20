import { arNames } from "@/data/names/ar";
import { deDE } from "@/data/names/de-DE";
import { enGB } from "@/data/names/en-GB";
import { enUS } from "@/data/names/en-US";
import { esES } from "@/data/names/es-ES";
import { esMX } from "@/data/names/es-MX";
import { filPH } from "@/data/names/fil-PH";
import { frFR } from "@/data/names/fr-FR";
import { hiIN } from "@/data/names/hi-IN";
import { idID } from "@/data/names/id-ID";
import { itIT } from "@/data/names/it-IT";
import { jaJP } from "@/data/names/ja-JP";
import { koKR } from "@/data/names/ko-KR";
import { ptBR } from "@/data/names/pt-BR";
import { ruRU } from "@/data/names/ru-RU";
import { thTH } from "@/data/names/th-TH";
import { trTR } from "@/data/names/tr-TR";
import { viVN } from "@/data/names/vi-VN";
import { zhCNNames } from "@/data/names/zh-CN";
import { zhTW } from "@/data/names/zh-TW";
import type { CountryNameData } from "@/data/names/types";

export const nameCountries: CountryNameData[] = [
  koKR,
  jaJP,
  zhCNNames,
  zhTW,
  enUS,
  enGB,
  frFR,
  deDE,
  esES,
  itIT,
  ptBR,
  ruRU,
  viVN,
  thTH,
  hiIN,
  idID,
  filPH,
  arNames,
  trTR,
  esMX,
];

export function getNameCountry(countryId: string): CountryNameData | undefined {
  return nameCountries.find((country) => country.id === countryId);
}

export type { CountryNameData, NameGender, NameOrder } from "@/data/names/types";
