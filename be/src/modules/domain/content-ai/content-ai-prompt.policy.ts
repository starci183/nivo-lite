import { vietnamClock } from "./content-ai-planning.policy"
import type { PlanChannel, PlanEvent, PlanPillar, PlanSlot } from "./content-ai-planning.policy"
import {
    CONTENT_AI_CHANNEL_RULES,
    CONTENT_AI_CLAIMS,
    CONTENT_AI_GUARDRAILS,
    CONTENT_AI_PROMPTS,
} from "./content-ai.templates"

/** Public business material. Callers must obtain sources and approved facts through the public knowledge lens. */
export interface BrandMaterial {
    /** Workspace shop name used in public marketing copy. */
    readonly shop: string
    /** Owner-selected voice and public marketing limits. */
    readonly authority: BrandAuthority
    /** Active content module setup and confirmed facts. */
    readonly setup: BrandSetup
    /** Sources admitted by the public content knowledge lens. */
    readonly sources: ReadonlyArray<BrandSource>
    /** Approved public facts admitted by the content knowledge lens. */
    readonly brainFacts: ReadonlyArray<BrandFact>
}

/** Owner-selected voice and marketing limits. */
export interface BrandAuthority {
    /** Owner-selected tone used when writing social posts. */
    readonly brandVoice: string
    /** Preferred communication style from authority settings. */
    readonly replyStyle: string
    /** Authority restrictions on claims and public communication. */
    readonly limitsNote: string
}

/** The active content module setup. */
export interface BrandSetup {
    /** Confirmed business summary from the active content setup. */
    readonly summary: string
    /** Confirmed business facts from the active content setup. */
    readonly facts: ReadonlyArray<string>
    /** Accepted tone gate from the active content setup. */
    readonly tone: string
    /** Accepted marketing-claims limits from the active setup. */
    readonly claimsLimits: string
    /** Intended customer audience of the content. */
    readonly audience: string
    /** Social channels selected by this content context. */
    readonly channels: string
}

/** One source admitted by the public content knowledge lens. */
export interface BrandSource {
    /** Idea or source title preserved for the owner. */
    readonly title: string
    /** Optional knowledge topic of this public source. */
    readonly topic: string | null
    /** Public knowledge text used to ground marketing claims. */
    readonly content: string
}

/** An approved public brain fact. */
export interface BrandFact {
    /** Human-readable subject label of the approved fact. */
    readonly subject: string
    /** Human-readable attribute label of the approved fact. */
    readonly attribute: string
    /** Approved public value of the business fact. */
    readonly value: string
}

/** The owner-editable brand fields used by marketing prompts. */
export interface BrandSettings {
    /** Owner-selected tone used when writing social posts. */
    readonly brandVoice: string
    /** Owner-defined statements and topics to avoid. */
    readonly avoid: string
    /** Preferred call to action used in drafted posts. */
    readonly cta: string
    /** Normalized tags kept within channel writing limits. */
    readonly hashtags: ReadonlyArray<string>
}

/** Bounded public context supplied to a content generation. */
export interface BrandContext {
    /** Workspace shop name used in public marketing copy. */
    readonly shop: string
    /** Bounded verified public business knowledge for prompts. */
    readonly knowledge: string
    /** Sources admitted by the public content knowledge lens. */
    readonly sources: ReadonlyArray<string>
    /** Combined tone and communication-style instructions. */
    readonly voice: string
    /** Owner-defined statements and topics to avoid. */
    readonly avoid: string
    /** Intended customer audience of the content. */
    readonly audience: string
    /** Preferred call to action used in drafted posts. */
    readonly cta: string
    /** Normalized owner tags added to selected channels. */
    readonly brandHashtags: ReadonlyArray<string>
}

/** One planned idea accepted from a model response. */
export interface PlanIdea {
    /** One-based deterministic slot the generated idea belongs to. */
    readonly slot: number
    /** Idea or source title preserved for the owner. */
    readonly title: string
    /** Concrete writing angle and supporting facts for this idea. */
    readonly brief: string
}

/** All of the non-brand context known about a post being drafted. */
export interface DraftBrief {
    /** Idea or source title preserved for the owner. */
    readonly title: string
    /** Concrete writing angle and supporting facts for this idea. */
    readonly brief: string
    /** Pillar assigned to this slot or selected for the draft. */
    readonly pillar: PlanPillar | null
    /** Available pillar names when the post has no assigned theme. */
    readonly pillarNames: ReadonlyArray<string>
    /** Planned UTC publishing instant, or null for unscheduled posts. */
    readonly scheduledAt: string | null
    /** Pinned occasion, or null when none applies. */
    readonly holiday: PlanEvent | null
    /** Owner-supplied drafting hint treated as input data. */
    readonly hint: string
    /** Recent post titles the writer should avoid repeating. */
    readonly recent: ReadonlyArray<string>
    /** Available media names indexed from one for suggestions. */
    readonly library: ReadonlyArray<string>
}

/** The stored writer output for one channel. */
export interface DraftVariant {
    /** Written channel copy awaiting owner review. */
    readonly text: string
    /** Normalized tags kept within channel writing limits. */
    readonly hashtags: ReadonlyArray<string>
    /** Writer note such as a filming or visual suggestion. */
    readonly note: string
}

/** A pre-approval finding retained for the owner's review. */
export type ClaimWarning =
    | { readonly kind: "promise"; readonly phrase: string }
    | { readonly kind: "figure"; readonly figure: string }
    | { readonly kind: "length"; readonly length: number; readonly max: number }

/** A finding attributed to its written channel. */
export interface ChannelWarning {
    /** Social channel whose cadence is being scheduled. */
    readonly channel: PlanChannel
    /** Claim or length finding requiring owner review. */
    readonly warning: ClaimWarning
}

/** Context for one request chunk of a monthly plan. */
export interface PlanUserInput {
    /** Plan month formatted YYYY-MM. */
    readonly month: string
    /** Fixed slot descriptions for this generation chunk. */
    readonly lines: ReadonlyArray<string>
    /** Actual offer lines identified in public knowledge. */
    readonly offers: string
    /** Existing idea titles to avoid duplicating. */
    readonly existing: ReadonlyArray<string>
}

/** Channel drafts and the findings the owner should review. */
export interface DraftVariantsResult {
    /** Written variants indexed by their social channel. */
    readonly variants: Partial<Record<PlanChannel, DraftVariant>>
    /** Claim and length findings attributed to their channels. */
    readonly warnings: ReadonlyArray<ChannelWarning>
}

type JsonParseOutcome =
    | { readonly kind: "parsed"; readonly value: Record<string, unknown> | null }
    | { readonly kind: "invalid"; readonly cause: unknown }

const parseObject = (source: string): JsonParseOutcome => {
    try {
        const value: unknown = JSON.parse(source)
        return { kind: "parsed", value: isJsonObject(value) ? value : null }
    } catch (cause) {
        return { kind: "invalid", cause }
    }
}

const KNOWLEDGE_BUDGET = 7000
const PER_SOURCE_BUDGET = 1600
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const PROMISE = CONTENT_AI_CLAIMS.promise.map((pattern) => new RegExp(pattern, "iu"))
const OFFER = new RegExp(CONTENT_AI_CLAIMS.offer, "iu")

/** Narrows a JSON value to an object. */
export const isJsonObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Extracts trimmed text without coercing model objects. */
export const trimmedText = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Clips a knowledge block and marks a truncation. */
export const clip = (value: string, max: number): string =>
    value.length > max ? `${value.slice(0, max).trimEnd()}...` : value

/** Normalizes and deduplicates model and brand hashtags. */
export const cleanHashtags = (list: ReadonlyArray<string>): Array<string> => [
    ...new Set(
        list
            .map((value) => {
                const word = value
                    .trim()
                    .replace(/^#+/u, "")
                    .replace(/[\s#]+/gu, "")
                return word === "" ? "" : `#${word}`
            })
            .filter((value) => value !== ""),
    ),
]

const joined = (parts: ReadonlyArray<string>): string =>
    parts
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .join(" | ")

const fittingSources = (sources: BrandMaterial["sources"]): Array<string> => {
    const blocks = sources.map(
        (s) => `### ${s.title}${s.topic ? ` (${s.topic})` : ""}\n${clip(s.content.trim(), PER_SOURCE_BUDGET)}`,
    )
    const out: Array<string> = []
    let used = 0
    for (const block of blocks) {
        if (used + block.length > KNOWLEDGE_BUDGET) break
        out.push(block)
        used += block.length
    }
    return out
}

/** Assembles public business knowledge, context limits, authority voice, and owner brand settings. */
export const buildBrand = (material: BrandMaterial, settings: BrandSettings): BrandContext => {
    const { setup } = material
    const brain =
        material.brainFacts.length > 0
            ? `Approved public business facts:\n${clip(material.brainFacts.map((f) => `- ${f.subject} - ${f.attribute}: ${f.value}`).join("\n"), 2500)}`
            : ""
    const knowledge = [
        setup.summary ? `Business summary:\n${setup.summary}` : "",
        setup.facts.length > 0 ? `Confirmed business facts:\n${setup.facts.map((fact) => `- ${fact}`).join("\n")}` : "",
        brain,
        ...fittingSources(material.sources),
    ]
        .filter((part) => part !== "")
        .join("\n\n")
    return {
        shop: material.shop,
        knowledge,
        sources: material.sources.map((source) => source.title),
        voice: joined([setup.tone, material.authority.brandVoice, material.authority.replyStyle, settings.brandVoice]),
        avoid: joined([setup.claimsLimits, material.authority.limitsNote, settings.avoid]),
        audience: setup.audience,
        cta: settings.cta.trim(),
        brandHashtags: cleanHashtags(settings.hashtags),
    }
}

/** A channel's writing limits. */
export const channelRule = (channel: PlanChannel): (typeof CONTENT_AI_CHANNEL_RULES)[number] =>
    CONTENT_AI_CHANNEL_RULES.find((rule) => rule.key === channel) ?? CONTENT_AI_CHANNEL_RULES[0]

/** The business block used by both planner and writer. */
export const brandBlock = (brand: BrandContext): string =>
    [
        `Business: ${brand.shop || "Unnamed business"}`,
        brand.audience ? `Audience: ${brand.audience}` : "",
        brand.voice ? `Brand voice: ${brand.voice}` : "Brand voice: friendly, clear, useful, and restrained.",
        brand.avoid ? `Prohibited claims and limits: ${brand.avoid}` : "",
        brand.cta ? `Preferred call to action: ${brand.cta}` : "",
        "Verified public business knowledge:",
        brand.knowledge || "No verified facts are available. Keep the copy general and do not invent business details.",
    ]
        .filter((part) => part !== "")
        .join("\n")

/** Never-break rules, including the public-only information boundary. */
export const guardrailBlock = (): string =>
    `Mandatory rules:\n${CONTENT_AI_GUARDRAILS.map((rule) => `- ${rule}`).join("\n")}`

/** Whether a knowledge line mentions an offer or event. */
export const isOfferLine = (line: string): boolean => OFFER.test(line)

/** Actual offer lines worth considering, capped to the previous planner's twelve-line limit. */
export const offerLines = (brand: BrandContext): string => {
    const hits = brand.knowledge.split("\n").filter(isOfferLine).slice(0, 12)
    return hits.length > 0 ? hits.join("\n") : "No actual offers are recorded. Do not invent any."
}

/** A Vietnam-time label used in prompts. */
export const localLabel = (iso: string): string => {
    const p = vietnamClock(new Date(iso))
    const pad = (n: number): string => String(n).padStart(2, "0")
    return `${WEEKDAYS[p.dow]} ${pad(p.day)}/${pad(p.m)}/${p.y} ${pad(p.h)}:${pad(p.min)}`
}

/** Describes an occasion without creating a promotion. */
export const occasionText = (event: PlanEvent): string =>
    `${event.name} on ${event.date.split("-").reverse().join("/")}: ${event.angle}`

/** The system prompt of a deterministic month plan. */
export const planSystem = (brand: BrandContext): string =>
    [CONTENT_AI_PROMPTS.planRole, brandBlock(brand), guardrailBlock(), CONTENT_AI_PROMPTS.planJson].join("\n\n")

/** A fixed slot, its theme, and optional pinned occasion. */
export const slotLine = (slot: PlanSlot, pillar: PlanPillar, holiday: PlanEvent | undefined | null): string =>
    `Slot ${slot.n}: ${localLabel(slot.at)}; channels: ${slot.channels.map((channel) => channelRule(channel).label).join(", ")}; theme: ${pillar.name}${pillar.description ? ` (${pillar.description})` : ""}${holiday ? `; occasion: ${occasionText(holiday)}` : ""}`

/** The user prompt for one chunk of the month plan. */
export const planUser = (input: PlanUserInput): string =>
    [
        `Plan month: ${input.month}`,
        `Required slots:\n${input.lines.join("\n")}`,
        `Actual offers in the knowledge:\n${input.offers}`,
        input.existing.length > 0
            ? `Existing titles to avoid repeating:\n${input.existing.map((title) => `- ${title}`).join("\n")}`
            : "",
        CONTENT_AI_PROMPTS.planRules,
    ]
        .filter((part) => part !== "")
        .join("\n\n")

/** Parses an object from a model answer that may contain a fence or surrounding prose. */
export const parseContentJson = (text: string): Record<string, unknown> | null => {
    const parse = (source: string): Record<string, unknown> | null => {
        const outcome = parseObject(source)
        return outcome.kind === "parsed" ? outcome.value : null
    }
    const body = text
        .trim()
        .replace(/^```(?:json)?\s*/iu, "")
        .replace(/```\s*$/u, "")
    const direct = parse(body)
    if (direct !== null) return direct
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const slice = body.slice(from, to + 1)
    const plain = parse(slice)
    if (plain !== null) return plain
    const open = slice.split("{").length - slice.split("}").length
    return open > 0 && open <= 3 ? parse(slice + "}".repeat(open)) : null
}

/** Reads valid numbered ideas from the model's plan. */
export const planIdeas = (parsed: Record<string, unknown>): Array<PlanIdea> =>
    (Array.isArray(parsed.ideas) ? parsed.ideas : []).flatMap((raw: unknown) => {
        if (!isJsonObject(raw)) return []
        const slot = typeof raw.slot === "number" ? raw.slot : Number(raw.slot)
        const title = trimmedText(raw.title).slice(0, 200)
        return Number.isFinite(slot) && title !== "" ? [{ slot, title, brief: trimmedText(raw.brief) }] : []
    })

/** The system prompt for the requested channel variants. */
export const draftSystem = (brand: BrandContext, channels: ReadonlyArray<PlanChannel>): string => {
    const shape = channels.map((channel) => `"${channel}":{"text":"...","hashtags":["#..."],"note":"..."}`).join(",")
    const rules = channels
        .map((channel) => {
            const rule = channelRule(channel)
            return `${rule.label}, maximum ${rule.maxChars} characters: ${rule.rules}`
        })
        .join("\n")
    return [
        CONTENT_AI_PROMPTS.draftRole,
        brandBlock(brand),
        guardrailBlock(),
        `Channel rules:\n${rules}`,
        CONTENT_AI_PROMPTS.draftJson.replace("__SHAPE__", shape),
    ].join("\n\n")
}

/** The post-specific user prompt. */
export const draftUser = (brief: DraftBrief): string =>
    [
        `Idea: ${brief.title}`,
        brief.brief ? `Brief: ${brief.brief}` : "",
        brief.pillar
            ? `Theme: ${brief.pillar.name}${brief.pillar.description ? ` (${brief.pillar.description})` : ""}`
            : `Choose one theme: ${brief.pillarNames.join("; ") || "none supplied"}`,
        brief.scheduledAt ? `Scheduled: ${localLabel(brief.scheduledAt)}` : "",
        brief.holiday ? `Occasion: ${occasionText(brief.holiday)}` : "",
        brief.hint ? `Owner hint: ${brief.hint}` : "",
        brief.recent.length > 0
            ? `Recent titles to avoid repeating:\n${brief.recent.map((title) => `- ${title}`).join("\n")}`
            : "",
        brief.library.length > 0
            ? `Available media library:\n${brief.library.map((name, i) => `${i + 1}. ${name}`).join("\n")}`
            : "No media library is available. Do not suggest media indices.",
    ]
        .filter((part) => part !== "")
        .join("\n\n")

/** Keeps written hashtags within channel limits and adds brand tags for TikTok and Instagram. */
export const channelHashtags = (
    channel: PlanChannel,
    written: unknown,
    brand: ReadonlyArray<string>,
): Array<string> => {
    const rule = channelRule(channel)
    const own = cleanHashtags(Array.isArray(written) ? written.map(String) : [])
    if (rule.hashtags.max === 0) return []
    const merged = channel === "tiktok" || channel === "instagram" ? cleanHashtags([...own, ...brand]) : own
    return merged.slice(0, rule.hashtags.max)
}

/** Checks outcome promises and offer figures absent from the public business knowledge. */
export const claimWarnings = (text: string, knowledge?: string): Array<ClaimWarning> => {
    const promises = PROMISE.flatMap((rule) => {
        const match = rule.exec(text)
        return match === null ? [] : [{ kind: "promise" as const, phrase: match[0] }]
    })
    if (knowledge === undefined) return promises
    const facts = knowledge.replace(/\s+/gu, "").toLowerCase()
    const figures: Array<ClaimWarning> = []
    text.replace(new RegExp(CONTENT_AI_CLAIMS.figure, "giu"), (match: string, capture: string) => {
        const figure = capture.replace(/\s+/gu, "").toLowerCase()
        if (!facts.includes(figure)) figures.push({ kind: "figure", figure: capture.trim() })
        return match
    })
    return [...promises, ...figures]
}

/** Reads channel variants and their review warnings; malformed or empty variants are ignored. */
export const draftVariants = (
    parsed: Record<string, unknown>,
    channels: ReadonlyArray<PlanChannel>,
    brand: BrandContext,
): DraftVariantsResult => {
    const written = isJsonObject(parsed.variants) ? parsed.variants : {}
    const variants: Partial<Record<PlanChannel, DraftVariant>> = {}
    const warnings: Array<ChannelWarning> = []
    for (const channel of channels) {
        const raw = written[channel]
        if (!isJsonObject(raw)) continue
        const text = trimmedText(raw.text)
        if (text === "") continue
        variants[channel] = {
            text,
            hashtags: channelHashtags(channel, raw.hashtags, brand.brandHashtags),
            note: trimmedText(raw.note),
        }
        const max = channelRule(channel).maxChars
        if (text.length > max * 1.25) warnings.push({ channel, warning: { kind: "length", length: text.length, max } })
        warnings.push(...claimWarnings(text, brand.knowledge).map((warning) => ({ channel, warning })))
    }
    return { variants, warnings }
}
