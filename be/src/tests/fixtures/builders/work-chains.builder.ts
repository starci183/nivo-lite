import { mockEntityManager, fakeQueryBuilder } from "@starci/jest-preset"
import { WorkThreadEntity } from "@modules/domain/work-threads"
import { WorkChainEntity } from "@modules/domain/work-chains"
import type { ChainStepRecord, NewChainStep } from "@modules/domain/work-chains"

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

/** What the chain proof manager answers for each read. */
export interface Answers {
    /** The thread the lock finds; null when the workspace has none with that id. */
    readonly thread?: { readonly id: string; readonly leadId: string | null } | null
    readonly history?: ReadonlyArray<ChainStepRecord>
    readonly inserted?: ReadonlyArray<unknown>
    readonly stored?: ReadonlyArray<ChainStepRecord>
    readonly active?: ReadonlyArray<unknown>
    readonly workspace?: ReadonlyArray<unknown>
    readonly settled?: ReadonlyArray<unknown>
    readonly name?: ReadonlyArray<unknown>
}

/** The query builder double the chain proof uses. */
export type FakeBuilder = ReturnType<typeof fakeQueryBuilder>

/**
 * The manager double, overridable per spec. The thread is found by entity, the chain reads are one builder over the chain entity
 * (the history, then the step read back), and every plain builder answers by what was chained on it: an insert answers the new id,
 * an update the settled step, a member list the active ids, a joined read the workspace owner, any other read a name.
 */
export const managerOf = (answers: Answers = {}) => {
    const thread = answers.thread === undefined ? { id: "thread-1", leadId: "lead-1" } : answers.thread
    const em = mockEntityManager({
        findOne: [WorkThreadEntity, thread === null ? null : Object.assign(new WorkThreadEntity(), thread)],
        update: [WorkChainEntity, { affected: 1, raw: [], generatedMaps: [] }],
    })
    const steps: FakeBuilder = fakeQueryBuilder({
        getRawMany: answers.history ?? [],
        getRawOne: (answers.stored ?? [rowOf({ id: "step-9", seq: 1 })])[0],
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
    const plains: Array<FakeBuilder> = []
    em.createQueryBuilder.mockImplementation(((entity?: unknown) => {
        if (entity === WorkChainEntity) return steps.builder
        const plain: FakeBuilder = fakeQueryBuilder({
            execute: () =>
                Promise.resolve({
                    raw:
                        plain.callsOf("insert").length > 0
                            ? (answers.inserted ?? [{ id: "step-9" }])
                            : (answers.settled ?? [{ thread_id: "thread-1", action: "Approve 8%" }]),
                }),
            getRawMany: answers.active ?? [{ id: "owner-1" }],
            getRawOne: () =>
                Promise.resolve(
                    plain.callsOf("innerJoin").length > 0
                        ? (answers.workspace ?? [{ id: "boss-1" }])[0]
                        : (answers.name ?? [{ name: "Mr Minh" }])[0],
                ),
        })
        plains.push(plain)
        return plain.builder
    }) as never)
    return { em, steps, plains }
}

/** The plain builder that carried the chained call, or undefined. */
export const chainedWith = (
    harness: { readonly plains: ReadonlyArray<FakeBuilder>; readonly steps: FakeBuilder },
    method: string,
) =>
    harness.plains.find((plain) => plain.callsOf(method).length > 0) ??
    (harness.steps.callsOf(method).length > 0 ? harness.steps : undefined)

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
