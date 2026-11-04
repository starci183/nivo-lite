import type { BadgeTone } from "@starci/grammar/common"
import type { useFormatter, useTranslations } from "next-intl"
import type { FlowWorkStatus, LeadGenHandoff, LeadGenLead, LeadGenSource, LeadScore } from "@/modules/types"

/** The translator of the Lead Gen catalog namespace. */
export type LeadGenTranslator = ReturnType<typeof useTranslations>

/** The reader's number and date formatter (next-intl, product time zone). */
export type LeadGenFormat = ReturnType<typeof useFormatter>

/** The badge tone of each score. */
const SCORE_TONES: Readonly<Record<LeadScore, BadgeTone>> = { hot: "danger", warm: "warning", cold: "neutral" }

/** The badge tone of where the Sales step of a handed-over lead stands. */
const CLASSIFY_TONES: Readonly<Record<FlowWorkStatus, BadgeTone>> = {
    queued: "neutral",
    done: "success",
    waiting_decision: "warning",
    rejected: "neutral",
    failed: "danger",
}

/** The stages a lead can be in, as the handoff line names them. */
const LEAD_STAGES: ReadonlySet<string> = new Set(["new", "qualified", "proposal", "won", "lost"])

/** The words of what a source points at: an ad, a form, else a post. */
const REF_KEYS: Readonly<Record<string, string>> = { ad: "refAd", form: "refForm" }

/** Day, month and time of an instant, the way every row of the workbench writes it. */
const whenOf = (format: LeadGenFormat, iso: string): string =>
    format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/** The label of a score, `none` when the lead was not scored yet. */
const scoreLabelOf = (t: LeadGenTranslator, score: LeadScore | null): string =>
    score ? t(`score_${score}`) : t("score_none")

/** What `leadsViewOf` returns. */
export interface LeadsViewOfResult {
    label: string
    emptyTitle: string
    emptyBody: string
    hiddenText: string | null
    rows: {
        id: string
        title: string
        href: string
        description: string
        badges: {
            label: string
            tone: BadgeTone
        }[]
    }[]
}

/** The words and rows of the prospects list. */
export const leadsViewOf = (
    t: LeadGenTranslator,
    format: LeadGenFormat,
    rows: ReadonlyArray<LeadGenLead>,
    hidden: number,
): LeadsViewOfResult => ({
    label: t("leadsLabel"),
    emptyTitle: t("leadsEmptyTitle"),
    emptyBody: t("leadsEmptyBody"),
    hiddenText: hidden > 0 ? t("leadsHidden", { n: hidden }) : null,
    rows: rows.map((row) => ({
        id: row.id,
        title: row.name,
        href: row.href,
        description: t("lastLine", { text: row.lastText || "—", when: whenOf(format, row.lastAt) }),
        badges: [
            {
                label: t("sourceBadge", {
                    platform: t(`platform_${row.origin.platform}`),
                    kind: t(`kind_${row.origin.kind}`),
                }),
                tone: "neutral" as const,
            },
            { label: scoreLabelOf(t, row.score), tone: row.score ? SCORE_TONES[row.score] : ("neutral" as const) },
        ],
    })),
})

/** What a source points at, in words: its label, else its post, ad or form. */
const sourceNameOf = (t: LeadGenTranslator, source: LeadGenSource): string => {
    const { refKind, refId, refLabel } = source.origin
    if (refLabel) return refLabel
    if (!refKind || !refId) return t("sourceNoRef")
    return t(REF_KEYS[refKind] ?? "refPost", { id: refId })
}

/** What `sourcesViewOf` returns. */
export interface SourcesViewOfResult {
    label: string
    emptyTitle: string
    emptyBody: string
    hiddenText: null
    rows: {
        id: string
        title: string
        href: null
        description: string
        badges: {
            label: string
            tone: "neutral"
        }[]
    }[]
}

/** The words and rows of the sources tab. */
export const sourcesViewOf = (t: LeadGenTranslator, rows: ReadonlyArray<LeadGenSource>): SourcesViewOfResult => ({
    label: t("sourcesLabel"),
    emptyTitle: t("sourcesEmptyTitle"),
    emptyBody: t("sourcesEmptyBody"),
    hiddenText: null,
    rows: rows.map((row) => ({
        id: row.key,
        title: sourceNameOf(t, row),
        href: null,
        description: t("sourceCounts", { leads: row.leads, hot: row.hot, won: row.won }),
        badges: [
            {
                label: t("sourceBadge", {
                    platform: t(`platform_${row.origin.platform}`),
                    kind: t(`kind_${row.origin.kind}`),
                }),
                tone: "neutral" as const,
            },
        ],
    })),
})

/** A lead stage in words; a stage the catalog does not know is written as it came. */
const stageNameOf = (t: LeadGenTranslator, stage: string): string =>
    LEAD_STAGES.has(stage) ? t(`stage_${stage}`) : stage

/** What `handoffsViewOf` returns. */
export interface HandoffsViewOfResult {
    label: string
    emptyTitle: string
    emptyBody: string
    hiddenText: null
    rows: {
        id: string
        title: string
        href: string
        description: string
        badges: (
            | {
                  label: string
                  tone: BadgeTone
                  isDot?: never
              }
            | {
                  label: string
                  tone: BadgeTone
                  isDot: boolean
              }
        )[]
    }[]
}

/** The words and rows of the hand-offs tab. */
export const handoffsViewOf = (
    t: LeadGenTranslator,
    format: LeadGenFormat,
    rows: ReadonlyArray<LeadGenHandoff>,
): HandoffsViewOfResult => ({
    label: t("handoffsLabel"),
    emptyTitle: t("handoffsEmptyTitle"),
    emptyBody: t("handoffsEmptyBody"),
    hiddenText: null,
    rows: rows.map((row) => ({
        id: row.key,
        title: row.name,
        href: row.href,
        description: [t("stageLine", { stage: stageNameOf(t, row.stage) }), whenOf(format, row.at)].join(" · "),
        badges: [
            { label: scoreLabelOf(t, row.score), tone: row.score ? SCORE_TONES[row.score] : ("neutral" as const) },
            {
                label: row.classify ? t(`classify_${row.classify}`) : t("classify_none"),
                tone: row.classify ? CLASSIFY_TONES[row.classify] : ("neutral" as const),
                isDot: true,
            },
        ],
    })),
})
