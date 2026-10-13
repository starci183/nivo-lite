import { aspectSize } from "./video-spec.policy"
import type { Aspect } from "./video-spec.policy"

/**
 * Burned-in text as one ASS (Advanced SubStation) file rendered by libass in the final pass. libass does the real line breaking with the
 * font's own metrics (WrapStyle 0 = smart, balanced lines, breaks only at spaces, which in Vietnamese are syllable boundaries). On top of that
 * we keep a number with its unit and the last two words together (the no-break space \h) so a caption never ends with one orphan syllable.
 */

/** One piece of burned-in text and the seconds it is shown. */
export interface TextCue {
    /** Second the cue appears. */
    readonly start: number
    /** Second the cue disappears. */
    readonly end: number
    /** The words. */
    readonly text: string
    /** Which style draws it. */
    readonly kind: "caption" | "headline" | "brand"
    /** True when the headline sits on a light card and needs dark text. */
    readonly light?: boolean
}

const FONT = "Be Vietnam Pro"

/** The ASS tag of a line break. */
const NEWLINE_TAG = String.raw`\N`

/** The ASS no-break space. */
const NO_BREAK_SPACE = String.raw`\h`

/** The ASS fade in and out of a cue, in milliseconds. */
const FADE_TAG = String.raw`{\fad(220,180)}`

const escaped = (text: string): string =>
    text
        .replace(/[{}]/gu, (char) => (char === "{" ? "(" : ")"))
        .replace(/\\/gu, "/")
        .replace(/\r?\n+/gu, NEWLINE_TAG)

/** How far above the bottom edge the caption sits, as a share of the frame height. */
const CAPTION_BOTTOM: Record<Aspect, number> = { "9:16": 0.15, "1:1": 0.09, "16:9": 0.08 }

/** Keeps short tails and number+unit pairs on one line; `units` matches the unit words that follow a number. */
export const keepTogether = (text: string, units: RegExp): string => {
    const words = text.trim().replace(/\s+/gu, " ").split(" ")
    if (words.length < 2) return words.join(" ")
    return words
        .map((word, index) => {
            if (index === words.length - 1) return word
            const next = words.slice(index + 1, index + 2).join("")
            // A number stays with its next number group or unit; a one- or two-letter word never ends a line; the last two words stay together.
            const joinNext =
                (/\d/u.test(word) && (/\d/u.test(next) || units.test(next))) ||
                index === words.length - 2 ||
                word.length <= 2
            return `${word}${joinNext ? NO_BREAK_SPACE : " "}`
        })
        .join("")
}

const stamp = (seconds: number): string => {
    const cs = Math.max(0, Math.round(seconds * 100))
    const hours = Math.floor(cs / 360000)
    const minutes = Math.floor((cs % 360000) / 6000)
    const secs = Math.floor((cs % 6000) / 100)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`
}

/** #rrggbb -> ASS &HAABBGGRR (alpha 00 = opaque). */
const assColor = (hex: string, alpha = 0): string => {
    const digits = hex.replace("#", "")
    const a = alpha.toString(16).toUpperCase().padStart(2, "0")
    return `&H${a}${digits.slice(4, 6)}${digits.slice(2, 4)}${digits.slice(0, 2)}`.toUpperCase()
}

const styleOf = (cue: TextCue): string => {
    if (cue.kind === "caption") return "Caption"
    if (cue.kind === "brand") return "Brand"
    return cue.light === true ? "HeadlineDark" : "Headline"
}

const dialogueOf = (cue: TextCue, units: RegExp): string => {
    const fade = cue.kind === "brand" ? "" : FADE_TAG
    const body =
        cue.kind === "brand" ? escaped(cue.text) : keepTogether(escaped(cue.text).replaceAll(NEWLINE_TAG, " "), units)
    return `Dialogue: ${cue.kind === "caption" ? 2 : 1},${stamp(cue.start)},${stamp(cue.end)},${styleOf(cue)},,0,0,0,,${fade}${body}`
}

/** The ASS document of the cues for an aspect; `units` matches the unit words that stay with their number. */
export const buildAss = (aspect: Aspect, cues: ReadonlyArray<TextCue>, units: RegExp): string => {
    const { width, height } = aspectSize(aspect)
    const base = Math.min(width, height)
    const sideMargin = Math.round(base * 0.085)
    const captionSize = Math.round(base * 0.056)
    const headlineSize = Math.round(base * 0.088)
    const brandSize = Math.round(base * 0.038)
    const captionBottom = Math.round(height * CAPTION_BOTTOM[aspect])
    const brandTop = Math.round(height * (aspect === "9:16" ? 0.055 : 0.04))
    const pad = Math.round(captionSize * 0.32)
    const styles = [
        // Name, Fontname, Fontsize, Primary, Secondary, Outline(box), Back(shadow), Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
        `Style: Caption,${FONT},${captionSize},&H00FFFFFF,&H00FFFFFF,${assColor("#000000", 0x40)},&H00000000,-1,0,0,0,100,100,0,0,3,${pad},0,2,${sideMargin},${sideMargin},${captionBottom},1`,
        `Style: Headline,${FONT},${headlineSize},&H00FFFFFF,&H00FFFFFF,&H64000000,&H96000000,-1,0,0,0,100,100,0,0,1,${Math.round(base * 0.006)},${Math.round(base * 0.004)},5,${sideMargin},${sideMargin},0,1`,
        `Style: HeadlineDark,${FONT},${headlineSize},&H00141414,&H00141414,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,1,0,0,5,${sideMargin},${sideMargin},0,1`,
        `Style: Brand,${FONT},${brandSize},${assColor("#ffffff", 0x30)},&H00FFFFFF,&H50000000,&H00000000,-1,0,0,0,100,100,2,0,1,${Math.round(base * 0.0025)},${Math.round(base * 0.002)},8,${sideMargin},${sideMargin},${brandTop},1`,
    ]
    const lines = cues
        .filter((cue) => cue.end > cue.start && cue.text.trim() !== "")
        .map((cue) => dialogueOf(cue, units))
    return [
        "[Script Info]",
        "ScriptType: v4.00+",
        `PlayResX: ${width}`,
        `PlayResY: ${height}`,
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        ...styles,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ...lines,
        "",
    ].join("\n")
}

/** Relative luminance of #rrggbb (0..1): picks dark or light headline text for a card. */
export const luminance = (hex: string): number => {
    const channel = (index: number): number => {
        const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}
