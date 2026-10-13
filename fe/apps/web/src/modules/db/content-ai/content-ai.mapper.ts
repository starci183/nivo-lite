import type { BrandMaterial } from "./read-brand"
import {
    GUARDRAILS,
    channelRule,
    clip,
    cleanHashtags,
    isJsonObject,
    pad2,
    trimmedText,
    vietnamClock,
    type ContentChannel,
    type ContentSettings,
    type DatedEvent,
    type Pillar,
    type PlanSlot,
} from "@/modules/content"

/** The part of a next-intl translator the prompt builders use. */
export interface PromptTranslator {
    (key: string, values?: Record<string, string | number>): string
    raw: (key: string) => unknown
}

/** The business context a prompt is grounded in. */
export interface BrandContext {
    readonly shop: string
    /** Real facts about the business (offers, products, policies) the posts may use. */
    readonly knowledge: string
    /** Titles of the knowledge sources, so a plan can say what it was grounded in. */
    readonly sources: ReadonlyArray<string>
    readonly voice: string
    readonly avoid: string
    readonly audience: string
    readonly cta: string
    readonly brandHashtags: ReadonlyArray<string>
}

const KNOWLEDGE_BUDGET = 7000
const PER_SOURCE_BUDGET = 1600

const rawText = (t: PromptTranslator, key: string): string => String(t.raw(key))

const joined = (parts: ReadonlyArray<string>): string =>
    parts
        .map((p) => p.trim())
        .filter((p) => p !== "")
        .join(" | ")

/** Documents that fit the knowledge budget, in order. */
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

/** Everything the posts are grounded in: the business knowledge, the tone gate of the applied context, the owner brand settings and limits. */
export const buildBrand = (t: PromptTranslator, material: BrandMaterial, settings: ContentSettings): BrandContext => {
    const { setup } = material
    const brain =
        material.brainFacts.length > 0
            ? t("promptKnowBrain", {
                  lines: clip(
                      material.brainFacts.map((f) => `- ${f.subject} - ${f.attribute}: ${f.value}`).join("\n"),
                      2500,
                  ),
              })
            : ""
    const knowledge = [
        setup.summary ? t("promptKnowSummary", { summary: setup.summary }) : "",
        setup.facts.length > 0 ? t("promptKnowConfirmed", { lines: setup.facts.map((f) => `- ${f}`).join("\n") }) : "",
        brain,
        ...fittingSources(material.sources),
    ]
        .filter((part) => part !== "")
        .join("\n\n")
    return {
        shop: material.shop,
        knowledge,
        sources: material.sources.map((s) => s.title),
        voice: joined([setup.tone, material.authority.brandVoice, material.authority.replyStyle, settings.brand_voice]),
        avoid: joined([setup.claimsLimits, material.authority.limitsNote, settings.avoid]),
        audience: setup.audience,
        cta: settings.cta.trim(),
        brandHashtags: cleanHashtags(settings.hashtags),
    }
}

/** The business block of a prompt. */
export const brandBlock = (t: PromptTranslator, b: BrandContext): string =>
    [
        t("promptBrandShop", { shop: b.shop || t("promptBrandNoShop") }),
        b.audience ? t("promptBrandAudience", { audience: b.audience }) : "",
        b.voice ? t("promptBrandVoice", { voice: b.voice }) : t("promptBrandVoiceDefault"),
        b.avoid ? t("promptBrandAvoid", { avoid: b.avoid }) : "",
        b.cta ? t("promptBrandCta", { cta: b.cta }) : "",
        "",
        t("promptBrandFacts"),
        b.knowledge || t("promptBrandNoKnowledge"),
    ]
        .filter((line) => line !== "")
        .join("\n")

/** The never-break rules of a prompt. */
export const guardrailBlock = (t: PromptTranslator): string =>
    `${t("promptGuardTitle")}\n${GUARDRAILS.map((g) => `- ${g}`).join("\n")}\n- ${t("promptGuardExtra")}`

/** Lines of the knowledge that talk about offers worth planning around. */
export const offerLines = (t: PromptTranslator, b: BrandContext, isOffer: (line: string) => boolean): string => {
    const hits = b.knowledge.split("\n").filter(isOffer).slice(0, 12)
    return hits.length > 0 ? hits.join("\n") : t("promptNoOffers")
}

/** "Monday 05/10/2026 19:30" for an instant in Vietnam time. */
export const localLabel = (t: PromptTranslator, iso: string): string => {
    const p = vietnamClock(new Date(iso))
    const day = String(t.raw("weekdaysLong")).split(",")[p.dow]
    return `${day} ${pad2(p.day)}/${pad2(p.m)}/${p.y} ${pad2(p.h)}:${pad2(p.min)}`
}

const dayMonthYear = (date: string): string => date.split("-").reverse().join("/")

/** The sentence about one occasion. */
export const occasionText = (t: PromptTranslator, h: DatedEvent): string =>
    t("promptOccasion", { name: h.name, date: dayMonthYear(h.date), angle: h.angle })

/** The system prompt of the month plan. */
export const planSystem = (t: PromptTranslator, brand: BrandContext): string =>
    [t("promptPlanRole"), brandBlock(t, brand), guardrailBlock(t), rawText(t, "promptPlanJson")].join("\n\n")

/** One line describing a posting slot, its theme and its occasion. */
export const slotLine = (
    t: PromptTranslator,
    slot: PlanSlot,
    theme: Pillar,
    occasion: DatedEvent | undefined,
): string =>
    t("promptSlotLine", {
        n: slot.n,
        when: localLabel(t, slot.at),
        channels: slot.channels.map((c) => channelRule(c).label).join(", "),
        theme: theme.name,
        themeDesc: theme.description ? t("promptSlotThemeDesc", { desc: theme.description }) : "",
        occasion: occasion ? t("promptSlotOccasion", { occasion: occasionText(t, occasion) }) : "",
    })

/** The user prompt of one chunk of the month plan. */
export const planUser = (
    t: PromptTranslator,
    input: {
        readonly month: string
        readonly lines: ReadonlyArray<string>
        readonly offers: string
        readonly existing: ReadonlyArray<string>
    },
): string =>
    [
        t("promptPlanMonth", { month: input.month }),
        t("promptPlanSlots", { lines: input.lines.join("\n") }),
        t("promptPlanOffers", { lines: input.offers }),
        input.existing.length > 0
            ? t("promptPlanExisting", { lines: input.existing.map((x) => `- ${x}`).join("\n") })
            : "",
        t("promptPlanRules"),
    ]
        .filter((part) => part !== "")
        .join("\n\n")

/** The ideas a plan answer contains: slot number, title and brief. */
export interface PlanIdea {
    readonly slot: number
    readonly title: string
    readonly brief: string
}

/** Reads the ideas out of a parsed plan answer; entries without a slot or title are dropped. */
export const planIdeas = (parsed: Record<string, unknown>): Array<PlanIdea> =>
    (Array.isArray(parsed.ideas) ? parsed.ideas : []).flatMap((raw: unknown) => {
        if (!isJsonObject(raw)) return []
        const slot = typeof raw.slot === "number" ? raw.slot : Number(raw.slot)
        const title = trimmedText(raw.title).slice(0, 200)
        return Number.isFinite(slot) && title !== "" ? [{ slot, title, brief: trimmedText(raw.brief) }] : []
    })

/** The system prompt of a draft for the given channels. */
export const draftSystem = (
    t: PromptTranslator,
    brand: BrandContext,
    channels: ReadonlyArray<ContentChannel>,
): string => {
    const shape = channels.map((c) => `"${c}":{"text":"...","hashtags":["#..."],"note":"..."}`).join(",")
    const rules = channels
        .map((c) => {
            const r = channelRule(c)
            return t("promptDraftChannelLine", { label: r.label, max: r.max_chars, rules: r.rules })
        })
        .join("\n")
    return [
        t("promptDraftRole"),
        brandBlock(t, brand),
        guardrailBlock(t),
        `${t("promptDraftChannelTitle")}\n${rules}`,
        rawText(t, "promptDraftJson").replace("__SHAPE__", shape),
    ].join("\n\n")
}

/** What the user prompt of a draft knows about the post. */
export interface DraftBrief {
    readonly title: string
    readonly brief: string
    readonly pillar: Pillar | null
    readonly pillarNames: ReadonlyArray<string>
    readonly scheduledAt: string | null
    readonly holiday: DatedEvent | null
    readonly hint: string
    readonly recent: ReadonlyArray<string>
    readonly library: ReadonlyArray<string>
}

/** The user prompt of a draft. */
export const draftUser = (t: PromptTranslator, b: DraftBrief): string => {
    const pillar = b.pillar
        ? t("promptDraftPillar", {
              name: b.pillar.name,
              desc: b.pillar.description ? t("promptSlotThemeDesc", { desc: b.pillar.description }) : "",
          })
        : t("promptDraftPillarChoices", { names: b.pillarNames.join("; ") || t("promptDraftNone") })
    return [
        t("promptDraftIdea", { title: b.title }),
        b.brief ? t("promptDraftBrief", { brief: b.brief }) : "",
        pillar,
        b.scheduledAt ? t("promptDraftWhen", { when: localLabel(t, b.scheduledAt) }) : "",
        b.holiday
            ? t("promptDraftHoliday", {
                  name: b.holiday.name,
                  date: dayMonthYear(b.holiday.date),
                  angle: b.holiday.angle,
              })
            : "",
        b.hint ? t("promptDraftHint", { hint: b.hint }) : "",
        b.recent.length > 0 ? t("promptDraftRecent", { lines: b.recent.map((r) => `- ${r}`).join("\n") }) : "",
        b.library.length > 0
            ? t("promptDraftLibrary", { lines: b.library.map((name, i) => `${i + 1}. ${name}`).join("\n") })
            : t("promptDraftNoLibrary"),
    ]
        .filter((part) => part !== "")
        .join("\n\n")
}
