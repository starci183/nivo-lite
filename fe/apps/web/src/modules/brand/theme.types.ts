/** The fonts a workspace may choose: every one carries the full Vietnamese glyph set. */
export const THEME_FONTS = ["inter", "be-vietnam-pro", "ibm-plex-sans", "lexend", "nunito", "roboto"] as const

/** The key of one font a workspace may choose. */
export type ThemeFont = (typeof THEME_FONTS)[number]

/** The corner steps a workspace may choose, square to large. */
export const THEME_RADII = ["square", "small", "medium", "large"] as const

/** The key of one corner step. */
export type ThemeRadius = (typeof THEME_RADII)[number]

/** The colour mode the console opens in when the person has chosen none. */
export const THEME_MODES = ["light", "dark"] as const

/** The key of one colour mode. */
export type ThemeMode = (typeof THEME_MODES)[number]

/**
 * The theme of one workspace, in the parameters of the HeroUI theme builder. Everything a screen wears is derived from these six
 * (and the optional mode), by the one function `deriveTheme`.
 */
export interface ThemeParams {
    /** The accent hue in degrees, 0 to 360. */
    readonly hue: number
    /** The accent chroma (oklch), 0 to 0.37. */
    readonly chroma: number
    /** The accent lightness (oklch) as a fraction, 0.2 to 0.95. */
    readonly lightness: number
    /** How much the neutrals lean to the accent hue, 0 to 1 (0.5 is the NIVO default). */
    readonly base: number
    /** The font. */
    readonly font: ThemeFont
    /** The corner step. */
    readonly radius: ThemeRadius
    /** The mode the console opens in; absent follows the person's own choice. */
    readonly mode?: ThemeMode
}

/** One colour mode of a derived theme: the CSS custom properties (`--accent`...) to their values. */
export type ThemeTokens = Readonly<Record<string, string>>

/** The theme as the screens wear it: the tokens of each mode, the radius variables and the font. */
export interface DerivedTheme {
    /** The tokens of the light mode. */
    readonly light: ThemeTokens
    /** The tokens of the dark mode. */
    readonly dark: ThemeTokens
    /** The radius custom properties (both modes). */
    readonly radius: ThemeTokens
    /** The CSS font-family stack of the chosen font. */
    readonly fontFamily: string
    /** The Google Fonts stylesheet address of the chosen font; null for the default font, which the app already loads. */
    readonly fontHref: string | null
}
