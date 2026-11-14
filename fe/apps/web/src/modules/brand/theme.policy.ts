import {
    THEME_FONTS,
    THEME_MODES,
    THEME_RADII,
    type DerivedTheme,
    type ThemeFont,
    type ThemeParams,
    type ThemeRadius,
    type ThemeTokens,
} from "./theme.types"

/** The NIVO default theme: the owner's brand set, which `brand.css` writes. */
export const DEFAULT_THEME: ThemeParams = {
    hue: 17.59,
    chroma: 0.222,
    lightness: 0.5858,
    base: 0.5,
    font: "inter",
    radius: "medium",
}

/** The ranges the parameters live in. */
export const THEME_RANGES = {
    hue: { min: 0, max: 360 },
    chroma: { min: 0, max: 0.37 },
    lightness: { min: 0.2, max: 0.95 },
    base: { min: 0, max: 1 },
} as const

/** The Google Fonts query of each font (family and weights); the family name is read from it, so a name is written once. */
const FONT_QUERIES: Readonly<Record<ThemeFont, string>> = {
    inter: "Inter",
    "be-vietnam-pro": "Be+Vietnam+Pro:wght@400;500;600;700",
    "ibm-plex-sans": "IBM+Plex+Sans:wght@400;500;600;700",
    lexend: "Lexend:wght@400;500;600;700",
    nunito: "Nunito:wght@400;500;600;700",
    roboto: "Roboto:wght@400;500;700",
}

/** The CSS family name of a font. */
const familyOf = (font: ThemeFont): string => {
    const [name = ""] = FONT_QUERIES[font].split(":")
    return name.replaceAll("+", " ")
}

/** The stylesheet address of a font; none for the default font, which the app already loads. */
const fontHrefOf = (font: ThemeFont): string | null =>
    font === DEFAULT_THEME.font ? null : `https://fonts.googleapis.com/css2?family=${FONT_QUERIES[font]}&display=swap`

/** The corner variables of each step: `--radius` and `--field-radius`. */
const RADII: Readonly<Record<ThemeRadius, { readonly radius: string; readonly field: string }>> = {
    square: { radius: "0", field: "0" },
    small: { radius: "0.25rem", field: "0.5rem" },
    medium: { radius: "0.5rem", field: "0.75rem" },
    large: { radius: "0.75rem", field: "1rem" },
}

/** The base at which the neutral chroma values below hold as written. */
const DEFAULT_BASE = 0.5

/** The text colour on an accent: near white, or near black, whichever contrasts more. */
const LIGHT_TEXT = { l: 99.11, c: 0 }
const DARK_TEXT = { l: 21.03, c: 0.0068 }

/** One neutral: its lightness in percent and its chroma at the default base. */
type Neutral = readonly [lightness: number, chroma: number]

const LIGHT_NEUTRALS: Readonly<Record<string, Neutral>> = {
    background: [97.02, 0.0068],
    border: [90, 0.0068],
    default: [94, 0.0068],
    "default-foreground": [21.03, 0.0059],
    "field-background": [100, 0.0034],
    "field-foreground": [21.03, 0.0068],
    "field-placeholder": [55.17, 0.0136],
    foreground: [21.03, 0.0068],
    muted: [55.17, 0.0136],
    overlay: [100, 0.002],
    "overlay-foreground": [21.03, 0.0068],
    segment: [100, 0.0068],
    "segment-foreground": [21.03, 0.0068],
    separator: [92, 0.0068],
    surface: [100, 0.0034],
    "surface-foreground": [21.03, 0.0068],
    "surface-secondary": [95.24, 0.0054],
    "surface-secondary-foreground": [21.03, 0.0068],
    "surface-tertiary": [93.73, 0.0054],
    "surface-tertiary-foreground": [21.03, 0.0068],
}

const DARK_NEUTRALS: Readonly<Record<string, Neutral>> = {
    background: [12, 0.0068],
    border: [28, 0.0068],
    default: [27.4, 0.0068],
    "default-foreground": [99.11, 0],
    "field-background": [21.03, 0.0136],
    "field-foreground": [99.11, 0.0068],
    "field-placeholder": [70.5, 0.0136],
    foreground: [99.11, 0.0068],
    muted: [70.5, 0.0136],
    overlay: [21.03, 0.0136],
    "overlay-foreground": [99.11, 0.0068],
    segment: [39.64, 0.0068],
    "segment-foreground": [99.11, 0.0068],
    separator: [25, 0.0068],
    surface: [21.03, 0.0136],
    "surface-foreground": [99.11, 0.0068],
    "surface-secondary": [25.7, 0.0102],
    "surface-secondary-foreground": [99.11, 0.0068],
    "surface-tertiary": [27.21, 0.0102],
    "surface-tertiary-foreground": [99.11, 0.0068],
}

/** A number as CSS writes it: at most `digits` decimals, no trailing zeros. */
const num = (value: number, digits: number): string => String(Number(value.toFixed(digits)))

/** An oklch colour as the app's stylesheet writes it; a colourless one carries hue 0. */
const oklch = (lightnessPercent: number, chroma: number, hue: number): string => {
    const c = Number(chroma.toFixed(4))
    return `oklch(${num(lightnessPercent, 2)}% ${num(c, 4)} ${c === 0 ? "0" : num(hue, 2)})`
}

/** The linear sRGB channels (unclamped) of an oklch colour; lightness is a fraction, hue in degrees. */
const linearOf = (l: number, c: number, hue: number): readonly [number, number, number] => {
    const rad = (hue * Math.PI) / 180
    const a = c * Math.cos(rad)
    const b = c * Math.sin(rad)
    const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
    return [
        4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
        -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
        -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
    ]
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const gamma = (linear: number): number => {
    const v = clamp01(linear)
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
}

/** The WCAG relative luminance of an oklch colour (out-of-gamut channels are clamped to sRGB). */
export const luminanceOf = (l: number, c: number, hue: number): number => {
    const [r, g, b] = linearOf(l, c, hue)
    return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b)
}

/** The WCAG contrast ratio of two luminances. */
export const contrastOf = (first: number, second: number): number => {
    const hi = Math.max(first, second)
    const lo = Math.min(first, second)
    return (hi + 0.05) / (lo + 0.05)
}

const hexChannel = (linear: number): string =>
    Math.round(gamma(linear) * 255)
        .toString(16)
        .padStart(2, "0")

/** The sRGB hex (`#rrggbb`) of an oklch colour, clamped into the gamut. */
export const oklchToHex = (l: number, c: number, hue: number): string => {
    const [r, g, b] = linearOf(l, c, hue)
    return `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`
}

/** The oklch parameters (`hue`, `chroma`, `lightness`) of an sRGB hex colour (`#rgb` or `#rrggbb`); null for text that is no hex colour. */
export const hexToOklch = (hex: string): Pick<ThemeParams, "hue" | "chroma" | "lightness"> | null => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(hex.trim())
    const digits = match?.[1]
    if (digits === undefined) return null
    const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits
    const toLinear = (offset: number): number => {
        const v = Number.parseInt(full.slice(offset, offset + 2), 16) / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const r = toLinear(0)
    const g = toLinear(2)
    const b = toLinear(4)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    const chroma = Math.hypot(a, bb)
    const hue = chroma < 1e-4 ? 0 : (Math.atan2(bb, a) * 180) / Math.PI
    return {
        hue: Number((((hue % 360) + 360) % 360).toFixed(2)),
        chroma: Number(Math.min(chroma, THEME_RANGES.chroma.max).toFixed(4)),
        lightness: Number(Math.min(Math.max(lightness, THEME_RANGES.lightness.min), THEME_RANGES.lightness.max).toFixed(4)),
    }
}

/** The text colour on an accent by computed WCAG contrast: whichever of the near-white and the near-black text contrasts more. */
const accentText = (params: ThemeParams): string => {
    const accent = luminanceOf(params.lightness, params.chroma, params.hue)
    const white = contrastOf(accent, luminanceOf(LIGHT_TEXT.l / 100, LIGHT_TEXT.c, 0))
    const black = contrastOf(accent, luminanceOf(DARK_TEXT.l / 100, DARK_TEXT.c, params.hue))
    return white >= black ? oklch(LIGHT_TEXT.l, LIGHT_TEXT.c, 0) : oklch(DARK_TEXT.l, DARK_TEXT.c, params.hue)
}

const tokensOf = (neutrals: Readonly<Record<string, Neutral>>, params: ThemeParams): Record<string, string> => {
    const scale = params.base / DEFAULT_BASE
    const tokens: Record<string, string> = {}
    for (const [name, [lightness, chroma]] of Object.entries(neutrals)) {
        tokens[`--${name}`] = oklch(lightness, chroma * scale, params.hue)
    }
    return tokens
}

/**
 * The ONE derivation: the parameters of a theme to every HeroUI brand token of both modes, the radius variables and the font. The default
 * parameters give exactly the values `brand.css` writes; the semantic colours (danger, success, warning, info) and the soft pairs are
 * no brand and stay where the stylesheet puts them. The text on the accent is chosen by contrast, never by lookup.
 */
export const deriveTheme = (params: ThemeParams): DerivedTheme => {
    const accent = oklch(params.lightness * 100, params.chroma, params.hue)
    const brand = { "--accent": accent, "--accent-foreground": accentText(params), "--focus": accent, "--field-border": "transparent" }
    const radius = RADII[params.radius]
    return {
        light: { ...brand, ...tokensOf(LIGHT_NEUTRALS, params) },
        dark: { ...brand, ...tokensOf(DARK_NEUTRALS, params) },
        radius: { "--radius": radius.radius, "--field-radius": radius.field },
        fontFamily: `"${familyOf(params.font)}", ui-sans-serif, system-ui, sans-serif`,
        fontHref: fontHrefOf(params.font),
    }
}

/** The font of a stored key; the default font for a key this build does not list. */
export const themeFontOf = (key: string): ThemeFont => THEME_FONTS.find((font) => font === key) ?? DEFAULT_THEME.font

/** The corner step of a stored key; the default step for a key this build does not list. */
export const themeRadiusOf = (key: string): ThemeRadius => THEME_RADII.find((radius) => radius === key) ?? DEFAULT_THEME.radius

/** The theme a workspace saved, as the parameters the derivation takes; the NIVO default while it saved none. */
export const themeOfWire = (
    row:
        | {
              readonly hue: number
              readonly chroma: number
              readonly lightness: number
              readonly base: number
              readonly font: string
              readonly radius: string
              readonly mode?: string | null | undefined
          }
        | null
        | undefined,
): ThemeParams => {
    if (row === null || row === undefined) return DEFAULT_THEME
    const mode = THEME_MODES.find((entry) => entry === row.mode)
    return {
        hue: row.hue,
        chroma: row.chroma,
        lightness: row.lightness,
        base: row.base,
        font: themeFontOf(row.font),
        radius: themeRadiusOf(row.radius),
        ...(mode === undefined ? {} : { mode }),
    }
}

const write = (tokens: ThemeTokens): string =>
    Object.entries(tokens)
        .map(([name, value]) => `${name}:${value};`)
        .join("")

/**
 * The theme as the stylesheet of a page: `:root`/`.light` and `.dark` blocks that override `brand.css`, and, for a font other than the
 * default, the `--font-sans` of the body (the class that carries the default font's variable has one class of weight, so `body[class]` wins).
 */
export const themeStyleSheet = (params: ThemeParams): string => {
    const derived = deriveTheme(params)
    const font = derived.fontHref === null ? "" : `body[class]{--font-sans:${derived.fontFamily};}`
    return `:root,.light{${write(derived.radius)}${write(derived.light)}}.dark{${write(derived.dark)}}${font}`
}


/**
 * The theme in one colour mode as the stylesheet of ONE selector, for a frame that previews it: the sample wears the tokens, the radius and
 * the font of the draft and the console around it does not. The selector is doubled so it outweighs the `.dark` block of `brand.css`.
 */
export const themeScopeSheet = (params: ThemeParams, mode: "light" | "dark", selector: string): string => {
    const derived = deriveTheme(params)
    const tokens = mode === "dark" ? derived.dark : derived.light
    const frame = "background:var(--background);color:var(--foreground);border-radius:var(--radius);"
    return `${selector}${selector}{${write(derived.radius)}${write(tokens)}--font-sans:${derived.fontFamily};font-family:var(--font-sans);${frame}}`
}
