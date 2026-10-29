import { IsNull } from "typeorm"
import type { FindOperator, UpdateQueryBuilder } from "typeorm"
import type { Evidence, InstallationScope } from "./brain-facts.contracts"
import type { BrainFactEntity } from "./persistence/entities"

/** The changes one update carries. */
export type FactChanges = Parameters<UpdateQueryBuilder<BrainFactEntity>["set"]>[0]

/** The columns a write answers, named as the entity properties so the answer reads as an entity. */
export const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    'installation_id AS "installationId"',
    'subject_type AS "subjectType"',
    'subject_key AS "subjectKey"',
    'subject_label AS "subjectLabel"',
    "attribute",
    'attribute_label AS "attributeLabel"',
    "value",
    'value_number AS "valueNumber"',
    "unit",
    "scope",
    "modules",
    "status",
    'source_kind AS "sourceKind"',
    "trust",
    'valid_from AS "validFrom"',
    'valid_to AS "validTo"',
    'supersedes_id AS "supersedesId"',
    'conflict_with AS "conflictWith"',
    "evidence",
    'proposed_by AS "proposedBy"',
    'proposed_at AS "proposedAt"',
    'decided_by AS "decidedBy"',
    'decided_at AS "decidedAt"',
    'decision_note AS "decisionNote"',
    'proposal_kind AS "proposalKind"',
].join(", ")

/** True when a RETURNING row names the key of a stored fact, the shape the returned columns give it. */
export const isBrainFactEntity = (value: unknown): value is BrainFactEntity =>
    typeof value === "object" &&
    value !== null &&
    ["id", "subjectKey"].every((field) => typeof Reflect.get(value, field) === "string")

/** The rows a write answered. */
export const returnedFacts = (raw: unknown): Array<BrainFactEntity> =>
    Array.isArray(raw) ? raw.filter(isBrainFactEntity) : []

/** The scope of an installation in a condition: a null installation means the workspace-wide facts, which is IS NULL and never "any". */
export const scopeOf = (installationId: InstallationScope): string | FindOperator<string> =>
    installationId === null ? IsNull() : installationId

/** The facts of one key waiting to be decided, the part of a condition every decision shares. */
export const factKeyOf = (
    workspaceId: string,
    subjectKey: string,
    attribute: string,
    installationId: InstallationScope,
) => ({
    workspaceId,
    subjectKey,
    attribute,
    installationId: scopeOf(installationId),
})

/** The fields of a new proposal; the instants and the evidence are written from text. */
export type NewFact = Omit<
    BrainFactEntity,
    | "id"
    | "status"
    | "proposedAt"
    | "decidedBy"
    | "decidedAt"
    | "decisionNote"
    | "updatedAt"
    | "supersedesId"
    | "validFrom"
    | "validTo"
    | "evidence"
> & {
    /** When the fact starts to hold, as text, or null. */
    readonly validFrom: string | null
    /** When the fact stops holding, as text, or null. */
    readonly validTo: string | null
    /** The evidence the fact rests on. */
    readonly evidence: ReadonlyArray<Evidence>
}
