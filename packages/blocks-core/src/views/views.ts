import { z } from "zod"
import type {
    ApproverView,
    BadgeView,
    CommandView,
    ConnectionRow,
    ConnectionsRegionView,
    DashboardRow,
    DecisionQueueView,
    DecisionRowView,
    FactView,
    ItemsRegionView,
    KnowledgeGapRow,
    KnowledgeGapsView,
    KnowledgeRegionView,
    PathStepView,
    SourceView,
    TraceView,
    WhyView,
} from "./views.types"

/** The longest text a view carries: a title, a description, a label or a line of detail. */
const TEXT_MAX = 2000
/** The longest key a row is drawn under. */
const ID_MAX = 200
/** The most rows, steps, badges or commands one view lists. */
const LIST_MAX = 500

const text = z.string().max(TEXT_MAX)
const id = z.string().max(ID_MAX)
const badgeTone = z.enum(["neutral", "accent", "success", "warning", "danger", "muted"])
const nullableText = text.nullable()

/** A bounded list of the given item shape. */
const list = <T extends z.ZodType>(item: T): z.ZodArray<T> => z.array(item).max(LIST_MAX)

const dashboardRow: z.ZodType<DashboardRow> = z.object({
    id,
    title: text,
    description: text,
    href: text,
})

/** The shape of a waiting or finished region. */
export const itemsRegionView: z.ZodType<ItemsRegionView> = z.object({
    count: nullableText,
    rows: list(dashboardRow),
    linkLabel: text,
    linkHref: text,
    more: nullableText,
})

const connectionRow: z.ZodType<ConnectionRow> = z.object({
    id,
    name: text,
    description: text,
    statusLabel: text,
    statusTone: badgeTone,
    accessLabel: text,
})

/** The shape of the connections region. */
export const connectionsRegionView: z.ZodType<ConnectionsRegionView> = z.object({
    manageLabel: text,
    manageHref: text,
    rows: list(connectionRow),
})

const knowledgeGapRow: z.ZodType<KnowledgeGapRow> = z.object({
    id,
    title: text,
    description: text,
    asked: text,
})

const knowledgeGapsView: z.ZodType<KnowledgeGapsView> = z.object({
    label: text,
    count: nullableText,
    openLabel: text,
    openHref: text,
    rows: list(knowledgeGapRow),
})

/** The shape of the knowledge region. */
export const knowledgeRegionView: z.ZodType<KnowledgeRegionView> = z.object({
    openLabel: text,
    openHref: text,
    footer: text,
    publicTitle: text,
    publicDescription: text,
    internalTitle: text,
    internalDescription: text,
    gaps: knowledgeGapsView.nullable(),
})

const traceView: z.ZodType<TraceView> = z.object({ line: text, whyHref: nullableText })

const commandView: z.ZodType<CommandView> = z.object({
    id,
    label: text,
    isPending: z.boolean().optional(),
    isDisabled: z.boolean().optional(),
    disabledReason: text.optional(),
    isDanger: z.boolean().optional(),
})

const badgeView: z.ZodType<BadgeView> = z.object({ label: text, tone: badgeTone })

const decisionRowView: z.ZodType<DecisionRowView> = z.object({
    id,
    title: text,
    description: text,
    badges: list(badgeView),
    reason: nullableText,
    amount: nullableText,
    proposal: text,
    trace: traceView.nullable(),
    expiry: nullableText,
    primary: commandView.nullable(),
    edit: commandView.nullable(),
    menu: list(commandView),
    waitingFor: nullableText,
})

/** The shape of the decision queue. */
export const decisionQueueView: z.ZodType<DecisionQueueView> = z.object({
    count: nullableText,
    more: z.object({ label: text, href: text }).nullable(),
    rows: list(decisionRowView),
})

const pathStepView: z.ZodType<PathStepView> = z.object({
    id,
    title: text,
    description: text,
    isCurrent: z.boolean(),
})

const factView: z.ZodType<FactView> = z.object({ id, term: text, value: text })

const sourceView: z.ZodType<SourceView> = z.object({
    id,
    kind: text,
    text: text,
    byline: text,
})

const approverView: z.ZodType<ApproverView> = z.object({
    name: text,
    seed: text,
    limit: text,
    onTimeout: text,
    usedPercent: z.number(),
    valueText: text,
})

/** The shape of the why pane of one work item. */
export const whyView: z.ZodType<WhyView> = z.object({
    heading: text,
    branch: text,
    reason: text,
    path: list(pathStepView),
    facts: list(factView),
    sources: list(sourceView),
    approver: approverView.nullable(),
    mapHref: text,
})
