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

const badgeTone = z.enum(["neutral", "accent", "success", "warning", "danger", "muted"])
const nullableText = z.string().nullable()

const dashboardRow: z.ZodType<DashboardRow> = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    href: z.string(),
})

/** The shape of a waiting or finished region. */
export const itemsRegionView: z.ZodType<ItemsRegionView> = z.object({
    count: nullableText,
    rows: z.array(dashboardRow),
    linkLabel: z.string(),
    linkHref: z.string(),
    more: nullableText,
})

const connectionRow: z.ZodType<ConnectionRow> = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    statusLabel: z.string(),
    statusTone: badgeTone,
    accessLabel: z.string(),
})

/** The shape of the connections region. */
export const connectionsRegionView: z.ZodType<ConnectionsRegionView> = z.object({
    manageLabel: z.string(),
    manageHref: z.string(),
    rows: z.array(connectionRow),
})

const knowledgeGapRow: z.ZodType<KnowledgeGapRow> = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    asked: z.string(),
})

const knowledgeGapsView: z.ZodType<KnowledgeGapsView> = z.object({
    label: z.string(),
    count: nullableText,
    openLabel: z.string(),
    openHref: z.string(),
    rows: z.array(knowledgeGapRow),
})

/** The shape of the knowledge region. */
export const knowledgeRegionView: z.ZodType<KnowledgeRegionView> = z.object({
    openLabel: z.string(),
    openHref: z.string(),
    footer: z.string(),
    publicTitle: z.string(),
    publicDescription: z.string(),
    internalTitle: z.string(),
    internalDescription: z.string(),
    gaps: knowledgeGapsView.nullable(),
})

const traceView: z.ZodType<TraceView> = z.object({ line: z.string(), whyHref: nullableText })

const commandView: z.ZodType<CommandView> = z.object({
    id: z.string(),
    label: z.string(),
    isPending: z.boolean().optional(),
    isDisabled: z.boolean().optional(),
    disabledReason: z.string().optional(),
    isDanger: z.boolean().optional(),
})

const badgeView: z.ZodType<BadgeView> = z.object({ label: z.string(), tone: badgeTone })

const decisionRowView: z.ZodType<DecisionRowView> = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    badges: z.array(badgeView),
    reason: nullableText,
    amount: nullableText,
    proposal: z.string(),
    trace: traceView.nullable(),
    expiry: nullableText,
    primary: commandView.nullable(),
    edit: commandView.nullable(),
    menu: z.array(commandView),
    waitingFor: nullableText,
})

/** The shape of the decision queue. */
export const decisionQueueView: z.ZodType<DecisionQueueView> = z.object({
    count: nullableText,
    more: z.object({ label: z.string(), href: z.string() }).nullable(),
    rows: z.array(decisionRowView),
})

const pathStepView: z.ZodType<PathStepView> = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    isCurrent: z.boolean(),
})

const factView: z.ZodType<FactView> = z.object({ id: z.string(), term: z.string(), value: z.string() })

const sourceView: z.ZodType<SourceView> = z.object({
    id: z.string(),
    kind: z.string(),
    text: z.string(),
    byline: z.string(),
})

const approverView: z.ZodType<ApproverView> = z.object({
    name: z.string(),
    seed: z.string(),
    limit: z.string(),
    onTimeout: z.string(),
    usedPercent: z.number(),
    valueText: z.string(),
})

/** The shape of the why pane of one work item. */
export const whyView: z.ZodType<WhyView> = z.object({
    heading: z.string(),
    branch: z.string(),
    reason: z.string(),
    path: z.array(pathStepView),
    facts: z.array(factView),
    sources: z.array(sourceView),
    approver: approverView.nullable(),
    mapHref: z.string(),
})
