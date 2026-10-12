/** Locales of the app. Vietnamese first (Brand V1.1: Vietnamese first for customer-facing copy). */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "NIVO_LOCALE";

export const toLocale = (value: string | undefined | null): Locale => (value === "en" || value === "vi" ? value : DEFAULT_LOCALE);

/** A dictionary: English is the source of keys; Vietnamese must provide every key. */
export type Dict<T extends Record<string, string>> = { readonly en: T; readonly vi: { readonly [K in keyof T]: string } };

/** Define a namespace dictionary with type-checked Vietnamese coverage. */
export const defineDict = <T extends Record<string, string>>(dict: Dict<T>): Dict<T> => dict;

export type Translate<T extends Record<string, string>> = (key: keyof T & string, vars?: Record<string, string | number>) => string;

/** Build a translator; `{name}` placeholders are replaced from `vars`. */
export const translator =
  <T extends Record<string, string>>(dict: Dict<T>, locale: Locale): Translate<T> =>
  (key, vars) => {
    const template = (dict[locale] as Record<string, string>)[key] ?? dict.en[key] ?? key;
    return vars ? template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : template;
  };

/** Intl locale tag for dates and numbers. */
export const intlLocale = (locale: Locale) => (locale === "vi" ? "vi-VN" : "en-GB");
export const TIME_ZONE = "Asia/Ho_Chi_Minh";
