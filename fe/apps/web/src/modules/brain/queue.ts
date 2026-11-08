import type { FindingCardActionView, FindingCardView } from "./finding-card"
import type { RowTone } from "./findings"
import type { TodoFilter } from "./todo"
import type {
    BrainFact,
    KnowledgeRowView,
    QueueActionView,
    QueueAsideView,
    QueueEntryView,
    QueueGlyph,
    QueueSource,
    QueueTileView,
    RowActionView,
} from "@/modules/types"

/** The words the entries are made of. */
export interface QueueWords {
    readonly choiceTitle: string
    readonly currentLabel: string
    readonly inUseTitle: (value: string) => string
    readonly inUseSource: (source: string) => string
    readonly proposedLabel: string
    readonly factFootnote: string
    readonly factKind: string
    readonly askKind: string
    readonly proposalKind: string
    readonly dossierStatus: string
    readonly openDossier: string
    readonly sourceQuotes: string
}

type RowBadgeTone = NonNullable<KnowledgeRowView["badges"]>[number]["tone"]

const TONE_OF_ROW: Readonly<Record<RowBadgeTone, RowTone>> = {
    neutral: "neutral",
    warning: "warning",
    success: "success",
    danger: "danger",
    accent: "accent",
}

/** The intent a command of a row wears here: no command of the queue is filled, so a filled or destructive one is a plain one. */
const intentOf = (intent: RowActionView["intent"]): QueueActionView["intent"] => {
    if (intent === "dismiss" || intent === "alternative") return intent
    return "neutral"
}

const actionOfRow = (action: RowActionView, partId?: string): QueueActionView => ({
    id: action.id,
    ...(partId === undefined ? {} : { partId }),
    label: action.label,
    intent: intentOf(action.intent),
    href: action.href ?? null,
    isPending: action.isPending === true,
})

const actionOfCard = (action: FindingCardActionView): QueueActionView => ({
    id: action.id,
    label: action.label,
    intent: action.intent === "dismiss" ? "dismiss" : "neutral",
    href: action.href,
    isPending: false,
})

/** The commands of a finding that sit in the item's menu: the rare ones (assign, mark done, ask NIVO to write, reopen). */
const MENU_ACTIONS: ReadonlySet<string> = new Set(["assign", "markDone", "askDraft", "reopen"])

const GLYPH_OF_SOURCE: Readonly<Record<Exclude<QueueSource, "finding">, QueueGlyph>> = {
    review: "fact",
    gaps: "ask",
    proposals: "proposal",
}

const KIND_WORD: Readonly<Record<Exclude<QueueSource, "finding">, (words: QueueWords) => string>> = {
    review: (words) => words.factKind,
    gaps: (words) => words.askKind,
    proposals: (words) => words.proposalKind,
}

const GLYPH_OF_KIND: Readonly<Record<string, QueueGlyph>> = {
    contradiction: "contradiction",
    missing: "missing",
    expired: "expired",
}

/** The row of the queue and the opened item of one finding. */
export const queueEntryOfFinding = (
    card: FindingCardView,
    kindKey: TodoFilter,
    words: QueueWords,
    aside: QueueAsideView | null,
): QueueEntryView => {
    const sides = card.actions.filter((action) => action.id.startsWith("confirm-"))
    const severity = card.badges.find((badge) => badge.id === "severity")?.label
    const ai = card.badges.find((badge) => badge.id === "ai")?.label
    const line = [card.dossier?.label, severity].filter((part): part is string => part !== undefined)
    return {
        id: `finding:${card.id}`,
        source: "finding",
        rawId: card.id,
        filter: kindKey,
        glyph: GLYPH_OF_KIND[kindKey] ?? "other",
        title: card.title,
        line: line.join(" · "),
        badge: card.kind,
        head: { title: card.title, description: [...line, ...(ai === undefined ? [] : [ai])].join(" · ") },
        detail: {
            heading: sides.length >= 2 ? words.choiceTitle : null,
            body: card.detail === "" ? null : card.detail,
            lines: card.meta === null ? [] : [card.meta],
            quotes: card.quotes,
            tiles: [],
            notice:
                card.inUse === null
                    ? null
                    : {
                          title: words.inUseTitle(card.inUse.value),
                          description: card.inUse.sourceTitle === null ? "" : words.inUseSource(card.inUse.sourceTitle),
                      },
            actions: card.actions
                .filter((action) => !MENU_ACTIONS.has(action.id))
                .map((action) => actionOfCard(action)),
            menu: card.actions.filter((action) => MENU_ACTIONS.has(action.id)).map((action) => actionOfCard(action)),
            footnote: null,
        },
        aside,
    }
}

/** The one line under a row's title: a fact reads as its proposed value and where it comes from, the rest as their first line. */
const lineOfRow = (row: KnowledgeRowView, source: Exclude<QueueSource, "finding">): string => {
    const first = row.parts?.[0]
    if (source === "review" && first?.value !== undefined)
        return [first.title, first.lines?.[0]].filter((part): part is string => part !== undefined).join(" · ")
    return row.lines?.[0] ?? ""
}

/** The opened item of a fact, a customer question or a proposed public answer, from the row its list drew. */
export const queueEntryOfRow = (
    row: KnowledgeRowView,
    source: Exclude<QueueSource, "finding">,
    words: QueueWords,
    aside: QueueAsideView | null,
): QueueEntryView => {
    const badge = row.badges?.[0]
    const kind = KIND_WORD[source](words)
    const lines = row.lines ?? []
    const current = source === "review" ? row.current : undefined
    const parts = row.parts ?? []
    const tiles: ReadonlyArray<QueueTileView> = parts.map((part, index) => ({
        id: part.id,
        label: source === "review" && parts.length === 1 && part.value !== undefined ? words.proposedLabel : null,
        title: part.value ?? part.title,
        lines: part.lines ?? [],
        isHighlighted: source === "review" && index === 0 && current !== undefined,
        actions: (part.actions ?? []).map((action) => actionOfRow(action, part.id)),
    }))
    const currentTile: ReadonlyArray<QueueTileView> =
        current === undefined
            ? []
            : [
                  {
                      id: `${row.id}-current`,
                      label: words.currentLabel,
                      title: current,
                      lines: [],
                      isHighlighted: false,
                      actions: [],
                  },
              ]
    return {
        id: `${source}:${row.id}`,
        source,
        rawId: row.id,
        filter: source === "review" ? "facts" : "ask",
        glyph: GLYPH_OF_SOURCE[source],
        title: row.title,
        line: lineOfRow(row, source),
        badge: { label: kind, tone: badge === undefined ? "neutral" : TONE_OF_ROW[badge.tone] },
        head: { title: row.title, description: lines.slice(0, 1).join(" · ") },
        detail: {
            heading: null,
            body: null,
            lines: source === "review" ? [] : lines,
            quotes: [],
            tiles: [...currentTile, ...tiles],
            notice: null,
            actions: (row.actions ?? []).map((action) => actionOfRow(action)),
            menu: [],
            footnote: source === "review" ? words.factFootnote : null,
        },
        aside,
    }
}

/** The side pane of a finding: the dossier it is filed under, and the way to it. */
export const queueAsideOfDossier = (
    card: FindingCardView,
    status: string | null,
    words: QueueWords,
): QueueAsideView | null =>
    card.dossier === null
        ? null
        : {
              title: card.dossier.label,
              terms: status === null ? [] : [{ id: "status", term: words.dossierStatus, text: status }],
              quotes: [],
              quotesTitle: words.sourceQuotes,
              action: { label: words.openDossier, href: card.dossier.href },
          }

/** The side pane of a waiting fact: the words of the documents it comes from, when its evidence has any; null otherwise. */
export const queueAsideOfFact = (
    facts: ReadonlyArray<BrainFact>,
    factId: string,
    words: QueueWords,
): QueueAsideView | null => {
    const quotes = (facts.find((fact) => fact.id === factId)?.evidence ?? []).flatMap((one, index) =>
        one.quote === undefined
            ? []
            : [{ id: `${factId}-${index}`, source: one.sourceTitle ?? one.label, byline: undefined, text: one.quote }],
    )
    if (quotes.length === 0) return null
    return { title: words.sourceQuotes, terms: [], quotes, quotesTitle: words.sourceQuotes, action: null }
}
