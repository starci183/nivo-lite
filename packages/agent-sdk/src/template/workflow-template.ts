import { graphSpecSchema } from "../graph/graph-spec.schema"
import type { GraphSpec } from "../graph/graph-spec.types"
import type { Bilingual } from "../module/module.types"
import { z } from "../schema/zod-entry"

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
 * A workflow template: a named graph a package ships and versions, with the connections it needs and its changelog. A workflow made
 * from a template copies the graph of one version and keeps only `{ templateId, templateVersion }` as provenance, so changing a
 * template never changes a workflow; a newer version is offered to the owner, never applied.
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

/** Reads one template file as its author wrote it; a file that does not parse throws, so a broken template fails its own package. */
export const parseWorkflowTemplate = (raw: unknown): WorkflowTemplate => templateSchema.parse(raw)

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
