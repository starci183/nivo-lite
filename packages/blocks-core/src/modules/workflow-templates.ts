import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { z } from "zod"
import { withDeclaredModels } from "../models"
import reconcile from "./accounting/template/workflows/reconcile.json"
import reports from "./accounting/template/workflows/reports.json"
import frontDesk from "./chatbot/template/workflows/front-desk.json"
import afterSale from "./sales/template/workflows/after-sale.json"
import consult from "./sales/template/workflows/consult.json"
import deliveryCheck from "./sales/template/workflows/delivery-check.json"
import occasion from "./sales/template/workflows/occasion.json"
import paymentReminder from "./sales/template/workflows/payment-reminder.json"
import webOrder from "./sales/template/workflows/web-order.json"

/** A connection a workflow template cannot run without: its kind, its name and why the graph needs it. */
export interface WorkflowTemplateConnection {
    /** The connection kind, as the connections catalogue names it (`sepay`, `google`, `zalo`, `telegram`). */
    readonly kind: string
    /** The name shown to the owner. */
    readonly label: Bilingual
    /** What the graph uses it for. */
    readonly why: Bilingual
}

/** One published version of a template: its number, when it was published, what changed and the full graph it holds. */
export interface WorkflowTemplateVersion {
    /** The version number, ascending and never reused: a template keeps only the versions it still ships, so its first may be above 1. */
    readonly version: number
    /** When it was published, ISO. */
    readonly publishedAt: string
    /** What changed against the version before, one line each. */
    readonly changes: ReadonlyArray<Bilingual>
    /** The whole graph of this version; a workflow made from it copies it and never points back to it. */
    readonly graph: GraphSpec
}

/**
 * A workflow template: a named graph NIVO ships and versions, with the connections it needs and its changelog. A workflow made from a
 * template copies the graph of one version and keeps only `{ templateId, templateVersion }` as provenance, so changing a template never
 * changes a workflow; a newer version is offered to the owner, never applied.
 */
export interface WorkflowTemplate {
    /** The stable id, `<module>.<slug>`. */
    readonly id: string
    /** The module whose agent runs it. */
    readonly moduleKey: string
    /** True for the template of the agent's main workflow (the one every wake of its module goes to by default). */
    readonly primary: boolean
    /**
     * True for a template the seed makes an ACTIVE workflow from (a part of the demo shop's chain, such as the thank-you a payment hands
     * off to); absent, a seeded workflow from it is a draft the owner turns on.
     */
    readonly seedActive?: boolean | undefined
    /** The name. */
    readonly name: Bilingual
    /** One line on what it does. */
    readonly summary: Bilingual
    /** The connections it needs. */
    readonly requires: ReadonlyArray<WorkflowTemplateConnection>
    /** How many shops of the market run a workflow made from it, as the catalogue counts them. */
    readonly shops: number
    /** Every version, oldest first. */
    readonly versions: ReadonlyArray<WorkflowTemplateVersion>
}

const bilingualSchema = z.object({ vi: z.string().min(1), en: z.string().min(1) }).strict()

const templateSchema = z
    .object({
        id: z.string().regex(/^[a-z]+\.[a-z-]+$/),
        moduleKey: z.string().min(1),
        primary: z.boolean(),
        seedActive: z.boolean().optional(),
        name: bilingualSchema,
        summary: bilingualSchema,
        requires: z.array(z.object({ kind: z.string().min(1), label: bilingualSchema, why: bilingualSchema }).strict()),
        shops: z.number().int().nonnegative(),
        versions: z
            .array(
                z
                    .object({
                        version: z.number().int().positive(),
                        publishedAt: z.iso.datetime(),
                        changes: z.array(bilingualSchema).min(1),
                        graph: graphSpecSchema,
                    })
                    .strict(),
            )
            .min(1),
    })
    .strict()

/**
 * Reads one template file; a file that does not parse fails the import, so a broken template never ships. Every node that calls AI
 * gets its declared model written on it (`withDeclaredModels`), so the model travels into the graph a workflow copies.
 */
const templateOf = (raw: unknown): WorkflowTemplate => {
    const template = templateSchema.parse(raw)
    return {
        ...template,
        versions: template.versions.map((version) => ({ ...version, graph: withDeclaredModels(version.graph) })),
    }
}

/** Every workflow template NIVO ships, in catalogue order. */
export const WORKFLOW_TEMPLATES: ReadonlyArray<WorkflowTemplate> = [
    reconcile,
    reports,
    consult,
    afterSale,
    webOrder,
    paymentReminder,
    deliveryCheck,
    occasion,
    frontDesk,
].map(
    templateOf,
)

/** The template of this id, or null. */
export const workflowTemplateOf = (id: string): WorkflowTemplate | null =>
    WORKFLOW_TEMPLATES.find((template) => template.id === id) ?? null

/** The templates of one module, in catalogue order. */
export const workflowTemplatesOf = (moduleKey: string): ReadonlyArray<WorkflowTemplate> =>
    WORKFLOW_TEMPLATES.filter((template) => template.moduleKey === moduleKey)

/** The newest version of a template. */
export const latestTemplateVersion = (template: WorkflowTemplate): WorkflowTemplateVersion =>
    template.versions.reduce((newest, version) => (version.version > newest.version ? version : newest))

/** One version of a template, or null when it has no such version. */
export const templateVersionOf = (template: WorkflowTemplate, version: number): WorkflowTemplateVersion | null =>
    template.versions.find((entry) => entry.version === version) ?? null

/** The versions of a template published after `version`, oldest first: what "the template has a newer version" offers. */
export const templateVersionsAfter = (
    template: WorkflowTemplate,
    version: number,
): ReadonlyArray<WorkflowTemplateVersion> => template.versions.filter((entry) => entry.version > version)
