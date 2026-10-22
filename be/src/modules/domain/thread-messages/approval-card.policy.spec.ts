import { Test } from "@nestjs/testing"
import { openCard, pendingOf, settleCard, withVote } from "./approval-card.policy"
import type { CardSource } from "./approval-card.policy"
import type { ThreadMessageRow } from "./persistence/thread-messages.rows"

const SUBJECT = Symbol("approval-card.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { openCard, pendingOf, settleCard, withVote } }],
    }).compile()
    return moduleRef.get<typeof import("./approval-card.policy")>(SUBJECT)
}

const source: CardSource = {
    ask: { action: "Discount 12%", amount: 12, unit: "percent", rule: "Customer discount" },
    opened: {
        requestId: "req-1",
        approvers: [
            { memberId: "minh", name: "Mr Minh", role: "manager", roomId: "sales" },
            { memberId: "nam", name: "Nam", role: "owner", roomId: null },
        ],
        excluded: [
            { memberId: "ha", reason: "limit" },
            { memberId: "gone", reason: "limit" },
        ],
        policy: "any",
        expiresAt: "2026-10-22T10:02:00.000Z",
    },
    names: { ha: "Ms Ha" },
    owner: { kind: "member", id: "minh", name: "Mr Minh" },
}

const messageRow = (approval: ThreadMessageRow["approval"]): ThreadMessageRow => ({
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "agent",
    author_id: "agent-1",
    author_name: "AI Sales",
    author_role: "sales",
    body: "x",
    quoted: [],
    mentions: [],
    approval,
    created_at: "2026-10-22T09:41:00+07:00",
})

const registerPending = () => {
    describe("pendingOf", () => {
        it("answers the card of a message that still waits", async () => {
            const subject = await buildSubject()
            const card = subject.openCard(source)
            const row = messageRow(card)

            expect(subject.pendingOf(row)).toEqual({ row, card })
        })

        it("answers nothing for a message with no card", async () => {
            const subject = await buildSubject()

            expect(subject.pendingOf(messageRow(null))).toBeNull()
        })

        it("answers nothing for a card already decided", async () => {
            const subject = await buildSubject()
            const settled = subject.settleCard(
                subject.openCard(source),
                { outcome: "rejected", decidedBy: "nam", decidedByName: "Nam" },
                new Date("2026-10-22T09:42:00.000Z"),
            )

            expect(subject.pendingOf(messageRow(settled))).toBeNull()
        })
    })
}

const registerOpen = () => {
    describe("openCard", () => {
        it("tags everyone the gate chose as waiting and names the ones it left out", async () => {
            const subject = await buildSubject()

            expect(subject.openCard(source)).toEqual({
                requestId: "req-1",
                action: "Discount 12%",
                amount: 12,
                unit: "percent",
                rule: "Customer discount",
                policy: "any",
                expiresAt: "2026-10-22T10:02:00.000Z",
                approvers: [
                    { memberId: "minh", name: "Mr Minh", role: "manager", roomId: "sales", status: "waiting" },
                    { memberId: "nam", name: "Nam", role: "owner", roomId: null, status: "waiting" },
                ],
                excluded: [
                    { memberId: "ha", reason: "limit", name: "Ms Ha" },
                    { memberId: "gone", reason: "limit", name: "" },
                ],
                outcome: "pending",
                decidedBy: null,
                decidedByName: null,
                decidedAt: null,
                owner: { kind: "member", id: "minh", name: "Mr Minh" },
            })
        })
    })
}

const registerVoteAndSettle = () => {
    describe("withVote", () => {
        it("records an approval and a rejection on the member's line only", async () => {
            const subject = await buildSubject()
            const card = subject.openCard(source)

            const approved = subject.withVote(card, "minh", "approve")
            const rejected = subject.withVote(card, "nam", "reject")

            expect(approved.approvers.map((approver) => approver.status)).toEqual(["approved", "waiting"])
            expect(rejected.approvers.map((approver) => approver.status)).toEqual(["waiting", "rejected"])
        })

        it("leaves the card alone for someone who is not tagged", async () => {
            const subject = await buildSubject()
            const card = subject.openCard(source)

            expect(subject.withVote(card, "stranger", "approve")).toEqual(card)
        })
    })

    describe("settleCard", () => {
        it("records how the request ended, who decided and when", async () => {
            const subject = await buildSubject()
            const card = subject.openCard(source)

            const settled = subject.settleCard(
                card,
                { outcome: "approved", decidedBy: "minh", decidedByName: "Mr Minh" },
                new Date("2026-10-22T09:42:00.000Z"),
            )

            expect(settled).toMatchObject({
                outcome: "approved",
                decidedBy: "minh",
                decidedByName: "Mr Minh",
                decidedAt: "2026-10-22T09:42:00.000Z",
            })
        })
    })
}

describe("approval card policy", () => {
    registerPending()
    registerOpen()
    registerVoteAndSettle()
})
