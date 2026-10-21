import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { Locale } from "@modules/platform/i18n"
import type { GuidelineKit, ImageCopy, MarketingDraft, ScriptBeat } from "./content-agent.contracts"
import type { DraftGuidance } from "./marketing-cards.contracts"

/** The time ranges of the three beats of the 15 second script. */
export const SCRIPT_BEATS: ReadonlyArray<string> = ["00-05s", "05-10s", "10-15s"]

const textOf = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const hashtagOf = (value: unknown): string => {
    const word = textOf(value, 40).replace(/^#+/u, "").replace(/\s+/gu, "")
    return word === "" ? "" : `#${word}`
}

const imagesOf = (value: unknown): ReadonlyArray<ImageCopy> =>
    (Array.isArray(value) ? value : [])
        .filter(isRecord)
        .map((entry) => ({ headline: textOf(entry.headline, 60), subline: textOf(entry.subline, 80) }))
        .filter((entry) => entry.headline !== "")
        .slice(0, 2)

const scriptOf = (value: unknown): ReadonlyArray<ScriptBeat> => {
    const lines = (Array.isArray(value) ? value : [])
        .map((entry) => textOf(isRecord(entry) ? entry.line : entry, 200))
        .filter((line) => line !== "")
    return SCRIPT_BEATS.flatMap((at, index) => {
        const line = lines[index]
        return line === undefined ? [] : [{ at, line }]
    })
}

/** The brand facts the draft prompt carries: palette names, tone, address, imagery and what to avoid. */
const brandLines = (kit: GuidelineKit | null): string =>
    kit === null
        ? "No brand kit yet: write in a warm, clear, honest tone."
        : [
              `Brand: ${kit.brandName}.`,
              `Tone: ${kit.tone}`,
              kit.address === "" ? "" : `Address: ${kit.address}`,
              kit.imagery.length === 0 ? "" : `Imagery: ${kit.imagery.join("; ")}`,
              kit.avoid.length === 0 ? "" : `Never use: ${kit.avoid.join("; ")}`,
          ]
              .filter((line) => line !== "")
              .join("\n")

/** The lessons and templates the prompt carries; nothing for a layer that holds none. */
const guidanceLines = (guidance: DraftGuidance): ReadonlyArray<string> => [
    ...(guidance.lessons.length === 0
        ? []
        : ["Learned from the owner's earlier edits (follow them):", ...guidance.lessons.map((line) => `- ${line}`)]),
    ...(guidance.templates.length === 0
        ? []
        : [
              "NIVO marketing templates (use their structure, never their facts):",
              ...guidance.templates.map((line) => `- ${line}`),
          ]),
]

/**
 * The prompt that turns one owner request into a post draft: caption, hashtags, two image texts and a 15 second script, written
 * in the brand and following the learned lessons and the NIVO templates of `guidance`.
 */
export const draftMessages = (
    request: string,
    kit: GuidelineKit | null,
    locale: Locale,
    guidance: DraftGuidance,
): ReadonlyArray<{ readonly role: "system" | "user"; readonly content: string }> => [
    {
        role: "system",
        content: [
            "You are the marketing agent of the business below. Write ONE social post draft for the owner's request.",
            'Answer ONE JSON object: {"title": string, "caption": string, "hashtags": [string],',
            '"images": [{"headline": string, "subline": string}, {"headline": string, "subline": string}],',
            '"script": [string, string, string]}.',
            "title: at most 8 words. caption: 3 to 5 short lines for Facebook and Zalo, no hashtags inside.",
            "hashtags: 2 to 4. images: two different image texts, headline at most 5 words, subline at most 8 words",
            "carrying the offer. script: three beats of five seconds each (what is shown and said).",
            "Only state offers, prices and dates the request gives; never invent them.",
            `Write in ${locale === "vi" ? "Vietnamese" : "English"}.`,
            brandLines(kit),
            ...guidanceLines(guidance),
        ].join("\n"),
    },
    { role: "user", content: request.trim().slice(0, 2000) },
]

/** The draft the model answered, or null when it has no caption or no image text. */
export const readDraft = (raw: string): MarketingDraft | null => {
    const read = parseJsonText(raw)
    if (!read.ok) return null
    const parsed = read.value
    if (!isRecord(parsed)) return null
    const caption = textOf(parsed.caption, 2000)
    const images = imagesOf(parsed.images)
    if (caption === "" || images.length === 0) return null
    const hashtags = (Array.isArray(parsed.hashtags) ? parsed.hashtags : []).map(hashtagOf).filter((tag) => tag !== "")
    return {
        title: textOf(parsed.title, 120) || caption.replace(/\n[\s\S]*$/u, "").slice(0, 120),
        caption,
        hashtags: [...new Set(hashtags)].slice(0, 6),
        images,
        script: scriptOf(parsed.script),
    }
}

/** The text a channel posts: the caption, a blank line, the hashtags. */
export const postTextOf = (draft: MarketingDraft): string =>
    draft.hashtags.length === 0 ? draft.caption : `${draft.caption}\n\n${draft.hashtags.join(" ")}`
