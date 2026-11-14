import type { WorkspaceTheme } from "./workspace-settings.contracts"

/** The fonts a workspace may choose (each carries the full Vietnamese glyph set); the console loads the chosen one. */
export const WORKSPACE_THEME_FONTS = ["inter", "be-vietnam-pro", "ibm-plex-sans", "lexend", "nunito", "roboto"] as const

/** The corner steps a workspace may choose. */
export const WORKSPACE_THEME_RADII = ["square", "small", "medium", "large"] as const

/** The colour modes a workspace may open the console in. */
export const WORKSPACE_THEME_MODES = ["light", "dark"] as const

/** The longest word the three closed lists allow (a font, a corner step, a mode): the text bound of each, never tighter than its data. */
export const WORKSPACE_THEME_WORD_MAX: number = Math.max(
    ...[...WORKSPACE_THEME_FONTS, ...WORKSPACE_THEME_RADII, ...WORKSPACE_THEME_MODES].map((word) => word.length),
)

/** The ranges of the numeric members: the HeroUI theme-builder parameters. */
export const WORKSPACE_THEME_RANGES = {
    hue: { min: 0, max: 360 },
    chroma: { min: 0, max: 0.37 },
    lightness: { min: 0.2, max: 0.95 },
    base: { min: 0, max: 1 },
} as const

/** The closed range of one numeric member. */
interface ThemeRange {
    readonly min: number
    readonly max: number
}

const isNumberIn = (value: unknown, range: ThemeRange): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max

const listed = <T extends string>(list: ReadonlyArray<T>, value: unknown): T | undefined =>
    list.find((entry) => entry === value)

/** What a validation answers: the theme with only its parameters kept, or null when a member is out of range or not in its list. */
export type ValidatedWorkspaceTheme = WorkspaceTheme | null

/** Validates a stored or sent theme by range and by list. Only the parameters are kept. */
export const validWorkspaceTheme = (input: unknown): ValidatedWorkspaceTheme => {
    if (typeof input !== "object" || input === null) return null
    const member = (key: string): unknown => Reflect.get(input, key)
    const hue = member("hue")
    const chroma = member("chroma")
    const lightness = member("lightness")
    const base = member("base")
    if (!isNumberIn(hue, WORKSPACE_THEME_RANGES.hue) || !isNumberIn(chroma, WORKSPACE_THEME_RANGES.chroma)) return null
    if (!isNumberIn(lightness, WORKSPACE_THEME_RANGES.lightness) || !isNumberIn(base, WORKSPACE_THEME_RANGES.base)) return null
    const font = listed(WORKSPACE_THEME_FONTS, member("font"))
    const radius = listed(WORKSPACE_THEME_RADII, member("radius"))
    if (font === undefined || radius === undefined) return null
    const hasMode = member("mode") !== undefined && member("mode") !== null
    const mode = listed(WORKSPACE_THEME_MODES, member("mode"))
    if (hasMode && mode === undefined) return null
    return { hue, chroma, lightness, base, font, radius, mode: mode ?? null }
}
