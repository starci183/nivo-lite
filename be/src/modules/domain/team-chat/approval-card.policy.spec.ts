import { Test } from "@nestjs/testing"
import { approvalCardOf, groupOf } from "./approval-card.policy"

const SUBJECT = Symbol("approval-card.policy")

const OPENED = {
    id: "11111111-1111-4111-8111-111111111111",
    action: "refund",
    amount: 200000,
    unit: "vnd",
    requestedByAgentId: "22222222-2222-4222-8222-222222222222",
}
const ROOM = "33333333-3333-4333-8333-333333333333"
const SEAT = "44444444-4444-4444-8444-444444444444"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { approvalCardOf, groupOf } }],
    }).compile()
    return moduleRef.get<{ approvalCardOf: typeof approvalCardOf; groupOf: typeof groupOf }>(SUBJECT)
}

describe("groupOf", () => {
    it("reads a stored group and refuses anything else", async () => {
        const subject = await buildSubject()
        expect(subject.groupOf({ roles: ["owner", "boss"], rooms: [ROOM], members: [SEAT] })).toEqual({
            roles: ["owner"],
            rooms: [ROOM],
            members: [SEAT],
        })
        expect(subject.groupOf(null)).toBeNull()
        expect(subject.groupOf("group")).toBeNull()
        expect(subject.groupOf({ roles: [], rooms: [1], members: [] })).toBeNull()
        expect(subject.groupOf({ roles: [], rooms: [] })).toBeNull()
    })
})

describe("approvalCardOf", () => {
    it("carries the request and the rooms and seats its rule names", async () => {
        const subject = await buildSubject()
        expect(subject.approvalCardOf(OPENED, { roles: ["owner"], rooms: [ROOM], members: [SEAT] })).toEqual({
            decisionId: OPENED.id,
            agentId: OPENED.requestedByAgentId,
            action: "refund",
            amount: 200000,
            unit: "vnd",
            roomIds: [ROOM],
            approverSeatIds: [SEAT],
        })
    })

    it("leaves out a room that is not a room id and a seat that is not a seat id, and keeps an absent agent and amount", async () => {
        const subject = await buildSubject()
        const card = subject.approvalCardOf(
            { ...OPENED, amount: null, requestedByAgentId: null },
            { roles: [], rooms: ["sales", ROOM], members: ["x"] },
        )
        expect(card).toMatchObject({ agentId: null, amount: null, roomIds: [ROOM], approverSeatIds: [] })
    })
})
