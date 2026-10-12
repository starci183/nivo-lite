"use client";

import { intlLocale } from "@/i18n/core";
import { useLocale } from "@/i18n/client";

/** Vietnamese dong in the reader's locale, e.g. "990.000 ₫". */
export const useMoney = () => {
  const locale = useLocale();
  return (n: number) => `${new Intl.NumberFormat(intlLocale(locale)).format(n)} ₫`;
};
