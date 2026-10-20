import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { Locale } from "@modules/platform/i18n"
import type { BrandColor, GuidelineKit } from "./content-agent.contracts"

/** The most guideline text the model reads. */
export const GUIDELINE_TEXT_MAX = 24_000

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/iu

/** A hex color as `#rrggbb` lower case, or null when it is not one. */
export const hexOf = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!HEX.test(trimmed)) return null
    const digits = trimmed.replace(/^#/u, "")
    const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits
    return `#${full.toLowerCase()}`
}

const textOf = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const textsOf = (value: unknown, count: number, max: number): ReadonlyArray<string> =>
    Array.isArray(value)
        ? value
              .map((entry) => textOf(entry, max))
              .filter((entry) => entry !== "")
              .slice(0, count)
        : []

const colorsOf = (value: unknown): ReadonlyArray<BrandColor> => {
    if (!Array.isArray(value)) return []
    const colors: Array<BrandColor> = []
    for (const entry of value) {
        const hex = hexOf(isRecord(entry) ? entry.hex : entry)
        if (hex === null || colors.some((color) => color.hex === hex)) continue
        const name = isRecord(entry) ? textOf(entry.name, 40) : ""
        colors.push({ name: name === "" ? hex : name, hex })
    }
    return colors.slice(0, 6)
}

/** The prompt that reads a brand guideline into a kit: one JSON object, nothing invented. */
export const brandKitMessages = (
    guideline: string,
    locale: Locale,
): ReadonlyArray<{ readonly role: "system" | "user"; readonly content: string }> => [
    {
        role: "system",
        content: [
            "You read a company's brand guideline and extract its brand kit.",
            'Answer ONE JSON object: {"brandName": string, "colors": [{"name": string, "hex": "#rrggbb"}],',
            '"fonts": [string], "tone": string, "address": string, "imagery": [string], "avoid": [string]}.',
            "colors: the brand palette, primary first, at most 6, hex exactly as the guideline gives them.",
            "fonts: the font family names, heading font first. tone: the tone of voice in at most two sentences.",
            "address: how the brand refers to itself and to the customer. imagery: at most 5 short phrases on photo style.",
            "avoid: words, claims or styles the guideline forbids. Use only what the guideline says; leave a field empty",
            `when it says nothing. Write tone, address, imagery and avoid in ${locale === "vi" ? "Vietnamese" : "English"}.`,
        ].join(" "),
    },
    { role: "user", content: guideline.slice(0, GUIDELINE_TEXT_MAX) },
]

/** The kit the model answered, or null when it is not a kit (no color and no tone). */
export const readBrandKit = (raw: string): GuidelineKit | null => {
    const read = parseJsonText(raw)
    if (!read.ok) return null
    const parsed = read.value
    if (!isRecord(parsed)) return null
    const kit: GuidelineKit = {
        brandName: textOf(parsed.brandName, 80),
        colors: colorsOf(parsed.colors),
        fonts: textsOf(parsed.fonts, 4, 60),
        tone: textOf(parsed.tone, 400),
        address: textOf(parsed.address, 200),
        imagery: textsOf(parsed.imagery, 5, 120),
        avoid: textsOf(parsed.avoid, 10, 120),
    }
    return kit.colors.length === 0 && kit.tone === "" ? null : kit
}

/** The kit with every field cleaned as the model's answer is (an edit on the card goes through the same rules). */
export const cleanBrandKit = (kit: GuidelineKit): GuidelineKit | null => readBrandKit(JSON.stringify(kit))

/** The brand voice line the content settings keep: the tone and how the brand addresses people. */
export const brandVoiceOf = (kit: GuidelineKit): string =>
    [kit.tone, kit.address].filter((part) => part !== "").join(" ")
