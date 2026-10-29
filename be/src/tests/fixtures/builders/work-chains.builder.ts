import { mockEntityManager, fakeQueryBuilder } from "@starci/jest-preset"
import { workChainsEntities } from "@modules/domain/work-chains"
import type { ChainStepRead, ChainStepRecord, NewChainStep } from "@modules/domain/work-chains"
import type { WorkThread } from "@modules/domain/work-threads"

const [WorkChainEntity] = workChainsEntities

/** The any-function matcher, typed `unknown` so it flows into any slot. */
export const anyFunction = (): unknown => expect.any(Function)

/** A chain step row of the proof, overridable. */
export const rowOf = (overrides: Partial<ChainStepRecord> = {}): ChainStepRecord => ({
    id: "step-1",
    seq: 1,
    actor_kind: "agent",
    actor_id: "agent-1",
    actor_name: "AI Sales",
    actor_role: "sales",
    kind: "self",
    action: "Take the booking",
    detail: "",
    rule: null,
    target: null,
    approval_request_id: null,
    status: "done",
    decided_by: null,
    started_at: new Date("2026-10-22T09:41:00+07:00"),
    finished_at: new Date("2026-10-22T09:41:00+07:00"),
    ...overrides,
})

/** The columns a chain read selects from the table: a step row without the name of whoever acted. */
export const readOf = (row: ChainStepRecord): ChainStepRead => ({
    id: row.id,
    seq: row.seq,
    actor_kind: row.actor_kind,
    actor_id: row.actor_id,
    kind: row.kind,
    action: row.action,
    detail: row.detail,
    rule: row.rule,
    target: row.target,
    approval_request_id: row.approval_request_id,
    status: row.status,
    decided_by: row.decided_by,
    started_at: row.started_at,
    finished_at: row.finished_at,
})

/** A new chain step of the proof, overridable. */
export const stepOf = (overrides: Partial<NewChainStep> = {}): NewChainStep => ({
    workspaceId: "ws-1",
    threadId: "thread-1",
    actor: { kind: "agent", id: "agent-1" },
    kind: "self",
    action: "Take the booking",
    detail: "",
    rule: null,
    target: null,
    approvalRequestId: null,
    locale: "vi",
    ...overrides,
})

/** The thread the owner of threads answers by default. */
export const threadOf = (overrides: Partial<WorkThread> = {}): WorkThread => ({
    id: "thread-1",
    workspaceId: "ws-1",
    title: "Villa booking",
    leadId: "lead-1",
    orderId: null,
    status: "open",
    createdBy: "member-1",
    createdAt: "2026-10-22T09:41:00+07:00",
    updatedAt: "2026-10-22T09:41:00+07:00",
    ...overrides,
})

/** What the chain proof answers for each read. */
export interface Answers {
    /** The thread the owner of threads finds; null when the workspace has none with that id. */
    readonly thread?: WorkThread | null
    /** The steps of the chain read from the table, with the names of whoever acted as the owners would give them. */
    readonly history?: ReadonlyArray<ChainStepRecord>
    readonly inserted?: ReadonlyArray<unknown>
    readonly stored?: ReadonlyArray<ChainStepRecord>
    /** The ids of the members the owner of members says are active. */
    readonly active?: ReadonlyArray<{ readonly id: string }>
    /** The seat of the workspace owner; none when the owner holds no seat. */
    readonly workspace?: ReadonlyArray<{ readonly id: string }>
    readonly settled?: ReadonlyArray<unknown>
    /** The display name of the member the owner of members finds; none when the member is gone. */
    readonly name?: ReadonlyArray<{ readonly name: string }>
}

/** The query builder double the chain proof uses. */
export type FakeBuilder = ReturnType<typeof fakeQueryBuilder>

const answersByManager = new WeakMap<object, Answers>()

/** The answers a manager double from {@link managerOf} was made with. */
export const answersOf = (manager: object): Answers => answersByManager.get(manager) ?? {}

/**
 * The manager double, overridable per spec. Every chain read and write is one builder over the chain entity (the history, then the
 * step read back, an insert answering the new id, an update the settled step); who acted, the thread and the members are answered by the
 * owners' services, which the spec builds from {@link answersOf}.
 */
export const managerOf = (answers: Answers = {}) => {
    const em = mockEntityManager({ update: [WorkChainEntity, { affected: 1, raw: [], generatedMaps: [] }] })
    answersByManager.set(em, answers)
    const steps: FakeBuilder = fakeQueryBuilder({
        getRawMany: (answers.history ?? []).map(readOf),
        getRawOne: readOfFirst(answers.stored ?? [rowOf({ id: "step-9", seq: 1 })]),
        execute: () => {
            const written = steps.calls.findLast((call) => call.method === "insert" || call.method === "update")
            return Promise.resolve({
                raw:
                    written?.method === "insert"
                        ? (answers.inserted ?? [{ id: "step-9" }])
                        : (answers.settled ?? [{ thread_id: "thread-1", action: "Approve 8%" }]),
            })
        },
    })
    em.createQueryBuilder.mockReturnValue(steps.builder as never)
    return { em, steps }
}

function readOfFirst(rows: ReadonlyArray<ChainStepRecord>): ChainStepRead | undefined {
    const [first] = rows
    return first === undefined ? undefined : readOf(first)
}

/** The chain builder when the chained call was made on it, or undefined. */
export const chainedWith = (harness: { readonly steps: FakeBuilder }, method: string) =>
    harness.steps.callsOf(method).length > 0 ? harness.steps : undefined

/** The values a step insert is expected to carry. */
export const insertedValues = (overrides: Record<string, unknown> = {}) => ({
    workspaceId: "ws-1",
    threadId: "thread-1",
    seq: anyFunction(),
    actorKind: "agent",
    actorId: "agent-1",
    kind: "self",
    action: "Take the booking",
    detail: "",
    rule: null,
    target: null,
    approvalRequestId: null,
    status: "done",
    finishedAt: anyFunction(),
    ...overrides,
})
