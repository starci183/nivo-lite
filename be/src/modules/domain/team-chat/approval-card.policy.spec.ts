import { approvalCardOf, groupOf } from "./approval-card.policy"

const OPENED = {
    id: "11111111-1111-4111-8111-111111111111",
    action: "refund",
    amount: 200000,
    unit: "vnd",
    requestedByAgentId: "22222222-2222-4222-8222-222222222222",
}
const ROOM = "33333333-3333-4333-8333-333333333333"
const SEAT = "44444444-4444-4444-8444-444444444444"

describe("groupOf", () => {
    it("reads a stored group and refuses anything else", () => {
        expect(groupOf({ roles: ["owner", "boss"], rooms: [ROOM], members: [SEAT] })).toEqual({
            roles: ["owner"],
            rooms: [ROOM],
            members: [SEAT],
        })
        expect(groupOf(null)).toBeNull()
        expect(groupOf("group")).toBeNull()
        expect(groupOf({ roles: [], rooms: [1], members: [] })).toBeNull()
        expect(groupOf({ roles: [], rooms: [] })).toBeNull()
    })
})

describe("approvalCardOf", () => {
    it("carries the request and the rooms and seats its rule names", () => {
        expect(approvalCardOf(OPENED, { roles: ["owner"], rooms: [ROOM], members: [SEAT] })).toEqual({
            decisionId: OPENED.id,
            agentId: OPENED.requestedByAgentId,
            action: "refund",
            amount: 200000,
            unit: "vnd",
            roomIds: [ROOM],
            approverSeatIds: [SEAT],
        })
    })

    it("leaves out a room that is not a room id and a seat that is not a seat id, and keeps an absent agent and amount", () => {
        const card = approvalCardOf(
            { ...OPENED, amount: null, requestedByAgentId: null },
            { roles: [], rooms: ["sales", ROOM], members: ["x"] },
        )
        expect(card).toMatchObject({ agentId: null, amount: null, roomIds: [ROOM], approverSeatIds: [] })
    })
})
