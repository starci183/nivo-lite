import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale, translator, type Dict, type Locale } from "./core";

/** The reader's locale from the cookie (defaults to Vietnamese). */
export const getLocale = async (): Promise<Locale> => toLocale((await cookies()).get(LOCALE_COOKIE)?.value);

/** Server-side translator for one namespace dictionary. */
export const getT = async <T extends Record<string, string>>(dict: Dict<T>) => translator(dict, await getLocale());
