/** The shortest display name an account may carry. */
export const NAME_MIN = 2

/** The longest display name an account may carry. */
export const NAME_MAX = 120

/** The shortest password an account may set. */
export const PASSWORD_MIN = 8

/** The longest password an account may set. */
export const PASSWORD_MAX = 256

/** The sign-in methods the account page lists, in order. */
export const METHOD_IDS = ["google", "email"] as const

/** A readable browser and operating system from a raw user agent; a null part is unknown. */
export interface Device {
    readonly browser: string | null
    readonly os: string | null
}

const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\//u, "Edge"],
    [/OPR\/|Opera/u, "Opera"],
    [/SamsungBrowser\//u, "Samsung Internet"],
    [/Firefox\/|FxiOS\//u, "Firefox"],
    [/CriOS\/|Chrome\//u, "Chrome"],
    [/Safari\//u, "Safari"],
    [/node|undici|curl|axios|python|go-http/iu, "API client"],
]

const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
    [/Windows/u, "Windows"],
    [/Android/u, "Android"],
    [/iPhone|iPad|iPod/u, "iOS"],
    [/Mac OS X|Macintosh/u, "macOS"],
    [/CrOS/u, "ChromeOS"],
    [/Linux/u, "Linux"],
]

/** Reads the browser and the system out of a user agent string. */
export const parseUserAgent = (userAgent: string | null | undefined): Device => {
    if (userAgent === null || userAgent === undefined || userAgent === "") return { browser: null, os: null }
    return {
        browser: BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
        os: SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
    }
}

/** The catalog keys (`account` namespace) of the failure sentences of the password and e-mail cards. */
export type AccountErrorKey = "errEmail" | "errEmailSame" | "errWrongCurrent" | "errNoPassword" | "unknownError"

/** The sentence that explains a failed Auth call of the account page. */
export const accountErrorKey = (code: string): AccountErrorKey => {
    switch (code) {
        case "email-same":
            return "errEmailSame"
        case "email-input":
            return "errEmail"
        case "wrong-current":
            return "errWrongCurrent"
        case "no-password":
            return "errNoPassword"
        default:
            return "unknownError"
    }
}
