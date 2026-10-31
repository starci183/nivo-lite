import type { AgentViewScope } from "@modules/domain/agents"
import type { Evidence, FactRecord } from "@modules/domain/brain-facts"
import { lensOf } from "@modules/domain/knowledge"
import type { Audience } from "@modules/domain/knowledge"
import { catalogAudienceOf } from "@modules/domain/module-audiences"

/**
 * The view one call of a native Brain tool answers for: the same view `knowledge.search` uses, never a wider one. The workspace is
 * the gateway caller's; the module and the instance come from the caller's agent; the audience is the lens of the module, narrowed
 * to the customer when the call serves a conversation.
 */
export interface NativeView {
    /** The workspace of the gateway caller. */
    readonly workspaceId: string
    /** The module of the caller's agent. */
    readonly module: string
    /** `customer` sees public knowledge only. */
    readonly audience: Audience
    /** The installation of a multi-instance agent, else null (the shared knowledge only). */
    readonly installationId: string | null
    /** False when the module is not in the catalogue: its documents cannot be searched, its facts can be read. */
    readonly searchable: boolean
}

/** The subject types no Brain tool serves, whoever asks: the Brain page keeps them and MCP does not. */
const WITHHELD_SUBJECTS: ReadonlySet<string> = new Set(["customer", "person"])

/** The view of a call: the agent's scope under the lens policy; an unknown module reads as a customer-facing one. */
export const viewOfCall = (workspaceId: string, scope: AgentViewScope, conversationId: string | null): NativeView => {
    const moduleAudience = catalogAudienceOf(scope.module)
    const lens = lensOf({
        workspaceId,
        module: scope.module,
        moduleAudience: moduleAudience ?? "customer",
        ...(conversationId === null ? {} : { requestedAudience: "customer" as const }),
        installationId: scope.installationId,
    })
    return {
        workspaceId: lens.workspaceId,
        module: lens.module,
        audience: lens.audience,
        installationId: lens.installationId,
        searchable: moduleAudience !== null,
    }
}

/** True when a Brain tool may serve a fact of this subject type. */
export const isServed = (fact: Pick<FactRecord, "subjectType">): boolean => !WITHHELD_SUBJECTS.has(fact.subjectType)

/** A fact as every Brain tool answers it. */
export interface FactLine {
    /** The fact id. */
    readonly id: string
    /** The subject as people write it. */
    readonly subject: string
    /** The attribute as people write it. */
    readonly attribute: string
    /** The value as written. */
    readonly value: string
    /** The unit, or null. */
    readonly unit: string | null
    /** How far the source is believed, 0 to 100. */
    readonly trust: number
}

/** The line of a fact: what it says and how far it is believed, no source and no scope. */
export const factLineOf = (fact: FactRecord): FactLine => ({
    id: fact.id,
    subject: fact.subjectLabel,
    attribute: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    trust: fact.trust,
})

/** What supports a fact, as a tool answers it: the kind and the label only. `quote`, `ref` and `connectionId` are dropped. */
export interface EvidenceLine {
    /** The kind of evidence. */
    readonly kind: string
    /** A short label for people. */
    readonly label: string
}

/** The evidence of a fact as kind and label. */
export const evidenceLinesOf = (evidence: ReadonlyArray<Evidence>): ReadonlyArray<EvidenceLine> =>
    evidence.map((item) => ({ kind: item.kind, label: item.label }))
