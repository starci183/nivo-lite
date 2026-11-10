import type { BrainFactsService, FactRecord } from "@modules/domain/brain-facts"
import type { ChangeCardPoster, LearningChange } from "./stop-learning.contracts"
import { StopLearningDoorService } from "./stop-learning-door.service"

const WS = "ws-1"

const change: LearningChange = {
    workspaceId: WS,
    agentId: "agent-1",
    origin: "learning",
    factKey: { subjectLabel: "Chuyển khoản sai mã", attributeLabel: "Đúng số tiền của đơn đang chờ" },
    oldValue: null,
    newValue: "ghi nhận cho đơn đang chờ",
    unit: null,
    validity: null,
    reason: "Đã hỏi chủ tiệm 2 lần về chuyển khoản sai mã; …",
    evidence: [
        {
            kind: "answer",
            quote: "Cứ ghi nhận cho đơn đang chờ",
            ref: "run:r1/step:match",
            by: { name: "Chủ tiệm Hà", memberId: "u-founder" },
            at: "2026-11-11T09:00:00.000Z",
        },
    ],
}

const factOf = (status: FactRecord["status"]): FactRecord => ({ id: "fact-9", status }) as unknown as FactRecord

const doorOf = (status: FactRecord["status"], outcome: "posted" | "no_room" | "not_waiting" = "posted", cards = true) => {
    const propose = jest.fn(() => Promise.resolve({ fact: factOf(status), outcome: "proposed" }))
    const get = jest.fn(() => Promise.resolve(factOf(status)))
    const post = jest.fn(() => Promise.resolve({ outcome }))
    const poster: ChangeCardPoster = { post }
    const door = new StopLearningDoorService({ propose, get } as unknown as BrainFactsService, cards ? poster : undefined)
    return { door, propose, post }
}

describe("StopLearningDoorService", () => {
    it("files the truth as a proposal that never applies, then posts its one card to the founder's room with the agent", async () => {
        const { door, propose, post } = doorOf("proposed")

        await expect(door.post(change)).resolves.toEqual({ changeId: "fact-9", state: "open" })

        expect(propose).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                subjectLabel: "Chuyển khoản sai mã",
                value: "ghi nhận cho đơn đang chờ",
                autoApply: false,
                sourceKind: "staff",
                evidence: [expect.objectContaining({ kind: "decision", ref: "run:r1/step:match", quote: "Cứ ghi nhận cho đơn đang chờ" })],
            }),
        )
        expect(post).toHaveBeenCalledWith({
            workspaceId: WS,
            changeId: "fact-9",
            origin: "learning",
            reason: change.reason,
            evidence: change.evidence,
            agentId: "agent-1",
            roomId: null,
        })
    })

    it("posts nothing when the truth already holds the value, or when there is no room or no poster", async () => {
        const active = doorOf("active")
        await expect(active.door.post(change)).resolves.toEqual({ changeId: "fact-9", state: "already_true" })
        expect(active.post).not.toHaveBeenCalled()

        await expect(doorOf("proposed", "no_room").door.post(change)).resolves.toMatchObject({ state: "not_posted" })
        await expect(doorOf("proposed", "posted", false).door.post(change)).resolves.toMatchObject({ state: "not_posted" })
        expect(doorOf("proposed", "posted", false).door.available()).toBe(false)
    })

    it("reads a change's state back from the truth graph", async () => {
        await expect(doorOf("proposed").door.stateOf(WS, "fact-9")).resolves.toBe("open")
        await expect(doorOf("active").door.stateOf(WS, "fact-9")).resolves.toBe("applied")
        await expect(doorOf("rejected").door.stateOf(WS, "fact-9")).resolves.toBe("rejected")
    })
})
