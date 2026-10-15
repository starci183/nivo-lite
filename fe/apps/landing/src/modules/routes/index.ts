import { appUrl } from "@/modules/config"

/** Every page the landing app serves itself. */
export const LANDING_ROUTES = {
    home: "/",
    privacy: "/privacy",
    terms: "/terms",
} as const

/** The pages of the console app the landing links to. */
export const CONSOLE_PAGES = {
    login: "/login",
    signup: "/signup",
} as const

/** The absolute address of a console page; the reader's language travels with it so the console opens in the language the landing was read in. */
export const appHref = (path: string, locale: string): string => `${appUrl()}${path}?lang=${encodeURIComponent(locale)}`
