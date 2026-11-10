import type { BrainChangePayloadGiven } from "./brain-change-card.contracts"
import {
    BRAIN_CHANGE_MESSAGE_KIND,
    brainChangeCardViewOf,
    brainChangeKeyOf,
    brainChangeMessageOf,
    countedPayloadOf,
    decidedPayloadOf,
    learningChangeIdsOf,
    storedBrainChangeOf,
    supersededPayloadOf,
} from "./brain-change-card.policy"
import { brainChangePayload, brainChangePayloadGiven } from "./brain-change-card.schema"

const GIVEN: BrainChangePayloadGiven = {
    version: 1,
    changeId: "p-ship",
    origin: "chat",
    kind: "change",
    factKey: { subjectLabel: "Giao hàng", attributeLabel: "Phí ship nội thành" },
    oldValue: "20.000 đ",
    current: { value: "20.000 đ", version: 2, source: "Quy định giao hàng.docx" },
    newValue: "30.000 đ",
    unit: null,
    validFrom: null,
    validTo: null,
    reason: "Anh vừa nhắn từ mai phí ship nội thành là 30k, thay giá 20.000 đ đang dùng.",
    evidence: [
        {
            kind: "message",
            quote: "từ mai phí ship nội thành là 30k nhé",
            ref: "team-chat:m1",
            by: { name: "nivo-owner", memberId: "u-owner" },
            at: "2026-11-11T17:40:00.000Z",
        },
    ],
    state: "open",
    decidedBy: null,
    supersededBy: null,
}

const storedOf = (payload: unknown): string => JSON.stringify({ kind: BRAIN_CHANGE_MESSAGE_KIND, title: "t", payload })

describe("brain.change card: schema", () => {
    it("reads the frozen contract plus its additive members", () => {
        expect(brainChangePayloadGiven.safeParse(GIVEN).success).toBe(true)
        expect(brainChangePayload.safeParse({ ...GIVEN, revision: 1 }).success).toBe(true)
    })

    it.each([
        ["an unknown state", { state: "done" }],
        ["an unknown origin", { origin: "customer" }],
        ["an empty reason", { reason: "" }],
        ["no evidence", { evidence: [] }],
    ])("refuses %s", (_name, changes) => {
        expect(brainChangePayloadGiven.safeParse({ ...GIVEN, ...changes }).success).toBe(false)
    })
})

describe("brain.change card: one card, rewritten in place", () => {
    it("names ONE line per change request", () => {
        expect(brainChangeKeyOf("p-ship")).toBe(brainChangeKeyOf("p-ship"))
        expect(brainChangeKeyOf("p-ship")).not.toBe(brainChangeKeyOf("p-other"))
    })

    it("counts the first write 1 and a write of the same request one more, keeping the evidence and adding the new", () => {
        const first = countedPayloadOf(GIVEN, null)
        expect(first.revision).toBe(1)
        const again = countedPayloadOf(
            {
                ...GIVEN,
                evidence: [...GIVEN.evidence, { ...GIVEN.evidence[0]!, ref: "team-chat:m2", quote: "nhớ nha 30k" }],
            },
            first,
        )
        expect(again.revision).toBe(2)
        expect(again.evidence.map((one) => one.ref)).toEqual(["team-chat:m1", "team-chat:m2"])
    })

    it("rewrites decided and superseded cards one write more, asking nothing after", () => {
        const open = countedPayloadOf(GIVEN, null)
        const applied = decidedPayloadOf(open, "applied", {
            memberId: "u-owner",
            name: "nivo-owner",
            at: "2026-11-11T17:45:00.000Z",
        })
        expect(applied).toMatchObject({ state: "applied", revision: 2, decidedBy: { name: "nivo-owner" } })
        expect(brainChangeMessageOf(applied).intent).toBe("notify")
        expect(supersededPayloadOf(open, "p-new")).toMatchObject({
            state: "superseded",
            supersededBy: "p-new",
            revision: 2,
        })
        expect(brainChangeMessageOf(open)).toMatchObject({
            kind: BRAIN_CHANGE_MESSAGE_KIND,
            intent: "ask",
            options: [],
            summary: "Giao hàng · Phí ship nội thành: 20.000 đ → 30.000 đ",
        })
    })
})

describe("brain.change card: only the workspace owner gets Đồng ý", () => {
    const stored = storedOf(countedPayloadOf(GIVEN, null))

    it.each([
        ["owner", true, true],
        ["manager", false, true],
        ["member", false, false],
    ] as const)("a %s viewing an open card: approve %s, reject %s", (role, approve, reject) => {
        expect(brainChangeCardViewOf(stored, role)).toMatchObject({
            canApprove: approve,
            canReject: reject,
            state: "open",
        })
    })

    it("offers nothing on a decided card, even to the owner", () => {
        const applied = decidedPayloadOf(countedPayloadOf(GIVEN, null), "applied", {
            memberId: "u-owner",
            name: "nivo-owner",
            at: "2026-11-11T17:45:00.000Z",
        })
        expect(brainChangeCardViewOf(storedOf(applied), "owner")).toMatchObject({ canApprove: false, canReject: false })
    })

    it("reads no card from another kind, a broken payload or no JSON", () => {
        expect(storedBrainChangeOf(null)).toBeNull()
        expect(storedBrainChangeOf("not json")).toBeNull()
        expect(storedBrainChangeOf(JSON.stringify({ kind: "workflow.stopped", payload: GIVEN }))).toBeNull()
        expect(storedBrainChangeOf(storedOf({ ...GIVEN, revision: 0 }))).toBeNull()
        expect(brainChangeCardViewOf("{}", "owner")).toBeNull()
    })
})

describe("brain.change card: what the proposal cost (U1, owner and manager only)", () => {
    const learned = countedPayloadOf({ ...GIVEN, origin: "learning" }, null)
    const costs = new Map([[learned.changeId, { credits: 0.3, usd: 0.000339 }]])

    it.each([
        ["owner", { credits: 0.3, usd: 0.000339 }],
        ["manager", { credits: 0.3, usd: 0.000339 }],
        ["member", null],
    ] as const)("a %s sees the cost %j", (role, cost) => {
        expect(brainChangeCardViewOf(storedOf(learned), role, costs)?.cost).toEqual(cost)
    })

    it("shows no cost when none was read, and names only the learning cards' changes, each once", () => {
        expect(brainChangeCardViewOf(storedOf(learned), "owner")?.cost).toBeNull()
        const chat = storedOf(countedPayloadOf({ ...GIVEN, changeId: "other" }, null))
        expect(learningChangeIdsOf([storedOf(learned), chat, storedOf(learned), null], 20)).toEqual([learned.changeId])
    })
})
