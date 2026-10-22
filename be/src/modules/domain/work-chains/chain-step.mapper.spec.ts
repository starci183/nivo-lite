import { Test } from "@nestjs/testing"
import { toChainStep } from "./chain-step.mapper"
import type { ChainStepRow } from "./persistence/work-chains.rows"

const SUBJECT = Symbol("chain-step.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toChainStep } }],
    }).compile()
    return moduleRef.get<typeof import("./chain-step.mapper")>(SUBJECT)
}

const rowOf = (overrides: Partial<ChainStepRow> = {}): ChainStepRow => ({
    id: "step-1",
    seq: 2,
    actor_kind: "agent",
    actor_id: "agent-1",
    actor_name: "AI Sales",
    actor_role: "sales",
    kind: "ask_approval",
    action: "Approve 8% discount",
    detail: "2 nights villa",
    rule: "Discount: ask first 3-15%",
    target: { kind: "group", id: "role:manager" },
    approval_request_id: "req-1",
    status: "waiting",
    decided_by: null,
    started_at: "2026-10-22T09:41:00+07:00",
    finished_at: null,
    ...overrides,
})

describe("chain step mapper", () => {
    it("reads a waiting approval step of an agent with its tagged group", async () => {
        const subject = await buildSubject()

        expect(subject.toChainStep(rowOf())).toEqual({
            id: "step-1",
            seq: 2,
            actor: { kind: "agent", id: "agent-1" },
            actorName: "AI Sales",
            actorRole: "sales",
            kind: "ask_approval",
            action: "Approve 8% discount",
            detail: "2 nights villa",
            rule: "Discount: ask first 3-15%",
            target: { kind: "group", id: "role:manager" },
            approvalRequestId: "req-1",
            status: "waiting",
            decidedBy: null,
            startedAt: "2026-10-22T02:41:00.000Z",
            finishedAt: null,
        })
    })

    it("reads a finished step of a member with no tag", async () => {
        const subject = await buildSubject()

        const step = subject.toChainStep(
            rowOf({
                actor_kind: "member",
                kind: "self",
                status: "done",
                target: null,
                decided_by: "member-1",
                finished_at: "2026-10-22T09:42:00+07:00",
            }),
        )

        expect(step).toMatchObject({
            actor: { kind: "member", id: "agent-1" },
            kind: "self",
            status: "done",
            target: null,
            decidedBy: "member-1",
            finishedAt: "2026-10-22T02:42:00.000Z",
        })
    })

    it("falls back to the plainest words when the stored ones are unknown", async () => {
        const subject = await buildSubject()

        const step = subject.toChainStep(
            rowOf({ kind: "mystery", status: "mystery", target: { kind: "mystery", id: "x" } }),
        )

        expect(step).toMatchObject({ kind: "self", status: "done", target: null })
    })

    it("keeps a tagged member and a tagged agent", async () => {
        const subject = await buildSubject()

        expect(subject.toChainStep(rowOf({ target: { kind: "member", id: "m-1" } })).target).toEqual({
            kind: "member",
            id: "m-1",
        })
        expect(subject.toChainStep(rowOf({ target: { kind: "agent", id: "a-2" } })).target).toEqual({
            kind: "agent",
            id: "a-2",
        })
    })
})
