import { ANY_FUNCTION } from "./any-function.builder"
import { builderOf } from "./entity-query-builder-fake.builder"
import { builder, mockEntityManager, fakeQueryBuilder } from "@starci/jest-preset"
import type { MockEntityManager, FakeQueryBuilder, QueryBuilderAnswers } from "@starci/jest-preset"
import { toProposal, workItemsEntities } from "@modules/domain/work-items"
import type { NewWorkItem, Proposal, WorkItemRecord } from "@modules/domain/work-items"

const [WorkItemEntity] = workItemsEntities
type WorkItemEntity = InstanceType<typeof WorkItemEntity>

/** The any-function matcher, typed `unknown` so it flows into any slot. */
export const anyFunction = (): unknown => ANY_FUNCTION

export const NOW = "2026-10-12T10:00:00.000Z"

export const proposal: Proposal = { summary: "Quote", fields: { items: "tea" } }

export const rowOf = builder<WorkItemRecord>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: { items: "tea" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: new Date("2026-10-12T09:00:00.000Z"),
    updated_at: new Date("2026-10-12T09:00:00.000Z"),
    completed_at: null,
    installation_id: null,
})

/** The stored item the record stands for. */
export const entityOf = (record: WorkItemRecord = rowOf()): WorkItemEntity =>
    Object.assign(new WorkItemEntity(), {
        id: record.id,
        workspaceId: record.workspace_id,
        department: record.department,
        action: record.action,
        subjectType: record.subject_type,
        subjectId: record.subject_id,
        leadId: record.lead_id,
        inboundEventId: record.inbound_event_id,
        parentId: record.parent_id,
        chainId: record.chain_id,
        depth: record.depth,
        status: record.status,
        decidedPath: record.decided_path,
        reason: record.reason,
        reasons: record.reasons,
        missingFields: record.missing_fields,
        proposal: record.proposal,
        result: record.result,
        error: record.error,
        evidenceState: record.evidence_state,
        assignedStaffId: record.assigned_staff_id,
        executionId: record.execution_id,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        leasedAt: null,
        completedAt: record.completed_at,
        installationId: record.installation_id,
    })

/** The contract an item reaches the callers as. */
export const contractOf = (record: WorkItemRecord = rowOf()) => ({
    ...record,
    proposal: toProposal(record.proposal),
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    completed_at: record.completed_at === null ? null : record.completed_at.toISOString(),
})

export const newItem: NewWorkItem = {
    workspaceId: "ws-1",
    chainId: null,
    depth: 0,
    department: "sales",
    action: "send_quote",
    subjectType: "lead",
    subjectId: "lead-1",
    leadId: "lead-1",
    inboundEventId: null,
    parentId: null,
    dedupeKey: "send_quote:lead-1",
    proposal,
    installationId: null,
}

/** A manager double whose every query builder is one fake that answers the given terminals and records the chain. */
export const managerAnswering = (answers: QueryBuilderAnswers, em: MockEntityManager = mockEntityManager()) => {
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(builderOf(fake.builder))
    return { em, fake }
}

/** The answer of an `UPDATE ... RETURNING` or an `INSERT ... RETURNING`. */
export const returned = (rows: ReadonlyArray<unknown>): QueryBuilderAnswers => ({ execute: { raw: rows } })

export const AT = new Date(NOW)

/** The first id the kit generator hands out. */
export const MINTED = "00000000-0000-4000-8000-000000000001"

/** The one call of a builder method; a builder method called more than once, or not at all, answers a description of that, which no expectation equals. */
export const singleCall = (fake: Pick<FakeQueryBuilder, "callsOf">, method: string): unknown => {
    const calls = fake.callsOf(method)
    return calls.length === 1 ? calls[0]?.[0] : { [`${method} was called`]: `${calls.length} times, expected once` }
}

/** The values the insert of `newItem` writes: the minted id, the queued status and the proposal. */
export const insertedValues = (overrides: Record<string, unknown> = {}) => ({
    id: MINTED,
    workspaceId: newItem.workspaceId,
    chainId: newItem.chainId,
    depth: newItem.depth,
    department: newItem.department,
    action: newItem.action,
    subjectType: newItem.subjectType,
    subjectId: newItem.subjectId,
    leadId: newItem.leadId,
    inboundEventId: newItem.inboundEventId,
    parentId: newItem.parentId,
    dedupeKey: newItem.dedupeKey,
    status: "queued",
    proposal: newItem.proposal,
    installationId: newItem.installationId,
    ...overrides,
})
