import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../bounds"
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
const id = z.string().max(MAX_ID)
const line = z.string().max(MAX_LINE)
const body = z.string().max(MAX_BODY)
const href = z.string().max(MAX_BODY)
const nullableText = line.nullable()

const dashboardRow: z.ZodType<DashboardRow> = z.object({
    id,
    title: line,
    description: body,
    href,
})

/** The shape of a waiting or finished region. */
export const itemsRegionView: z.ZodType<ItemsRegionView> = z.object({
    count: nullableText,
    rows: z.array(dashboardRow).max(MAX_ENTRIES),
    linkLabel: line,
    linkHref: href,
    more: nullableText,
})

const connectionRow: z.ZodType<ConnectionRow> = z.object({
    id,
    name: line,
    description: body,
    statusLabel: line,
    statusTone: badgeTone,
    accessLabel: line,
})

/** The shape of the connections region. */
export const connectionsRegionView: z.ZodType<ConnectionsRegionView> = z.object({
    manageLabel: line,
    manageHref: href,
    rows: z.array(connectionRow).max(MAX_ENTRIES),
})

const knowledgeGapRow: z.ZodType<KnowledgeGapRow> = z.object({
    id,
    title: line,
    description: body,
    asked: line,
})

const knowledgeGapsView: z.ZodType<KnowledgeGapsView> = z.object({
    label: line,
    count: nullableText,
    openLabel: line,
    openHref: href,
    rows: z.array(knowledgeGapRow).max(MAX_ENTRIES),
})

/** The shape of the knowledge region. */
export const knowledgeRegionView: z.ZodType<KnowledgeRegionView> = z.object({
    openLabel: line,
    openHref: href,
    footer: body,
    publicTitle: line,
    publicDescription: body,
    internalTitle: line,
    internalDescription: body,
    gaps: knowledgeGapsView.nullable(),
})

const traceView: z.ZodType<TraceView> = z.object({ line: body, whyHref: href.nullable() })

const commandView: z.ZodType<CommandView> = z.object({
    id,
    label: line,
    isPending: z.boolean().optional(),
    isDisabled: z.boolean().optional(),
    disabledReason: body.optional(),
    isDanger: z.boolean().optional(),
})

const badgeView: z.ZodType<BadgeView> = z.object({ label: line, tone: badgeTone })

const decisionRowView: z.ZodType<DecisionRowView> = z.object({
    id,
    title: line,
    description: body,
    badges: z.array(badgeView).max(MAX_ENTRIES),
    reason: nullableText,
    amount: nullableText,
    proposal: body,
    trace: traceView.nullable(),
    expiry: nullableText,
    primary: commandView.nullable(),
    edit: commandView.nullable(),
    menu: z.array(commandView).max(MAX_ENTRIES),
    waitingFor: nullableText,
})

/** The shape of the decision queue. */
export const decisionQueueView: z.ZodType<DecisionQueueView> = z.object({
    count: nullableText,
    more: z.object({ label: line, href }).nullable(),
    rows: z.array(decisionRowView).max(MAX_ENTRIES),
})

const pathStepView: z.ZodType<PathStepView> = z.object({
    id,
    title: line,
    description: body,
    isCurrent: z.boolean(),
})

const factView: z.ZodType<FactView> = z.object({ id, term: line, value: line })

const sourceView: z.ZodType<SourceView> = z.object({
    id,
    kind: line,
    text: body,
    byline: line,
})

const approverView: z.ZodType<ApproverView> = z.object({
    name: line,
    seed: id,
    limit: line,
    onTimeout: line,
    usedPercent: z.number(),
    valueText: body,
})

/** The shape of the why pane of one work item. */
export const whyView: z.ZodType<WhyView> = z.object({
    heading: line,
    branch: line,
    reason: body,
    path: z.array(pathStepView).max(MAX_ENTRIES),
    facts: z.array(factView).max(MAX_ENTRIES),
    sources: z.array(sourceView).max(MAX_ENTRIES),
    approver: approverView.nullable(),
    mapHref: href,
})
