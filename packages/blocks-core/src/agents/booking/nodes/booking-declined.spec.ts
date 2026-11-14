import { TOOL } from "@nivo-lite/agent-sdk/names"
import { templateExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { bookingBookGraph } from "../graphs/book.graph"
import { refused } from "../../../shared/nodes/tool-answers"
import { bookingBookNode } from "./book.node"
import { bookingConfirmNotifyNode } from "./confirm-notify.node"

/*
 * engine-core rule 4 (never branch on errors), on the booking nodes EF-G migrated: a person's decline of a write is a DATA outcome.
 * The tool answers `{ ok: false, declined: true }` (the scripted `declined` refusal, read as the engine answers it); the node RETURNS its
 * declined output: the SDK's example runner reports any `ctx.fail` (`failed …, expected output`) and any throw (`threw …`) as a mismatch,
 * so an empty list proves nothing was thrown. The graph routes that output to the outcome `declined`: by the node's route
 * (`booking.book`, route `declined`) and by an `if` on the data (`booking.confirm-notify`, `notify-declined` on `result == declined`).
 */

/** A step of the booking graph by key. */
const stepOf = (key: string) => bookingBookGraph.spec.nodes.find((step) => step.key === key)

const SLOT = {
    startAt: "2026-11-16T02:00:00.000Z",
    endAt: "2026-11-16T03:00:00.000Z",
    blockEndAt: "2026-11-16T03:00:00.000Z",
    resourceId: "r1",
}

describe("a declined write is data, never an error (booking)", () => {
    it("booking.book: a declined record RETURNS branch `declined` (no ctx.fail, no throw); its route reaches the outcome `declined`", async () => {
        const mismatches = await templateExampleMismatches(bookingBookNode, {
            name: "the record declined",
            params: {},
            input: {
                conversationId: "c1",
                text: "9:00 is fine, my name is Hoa",
                timeZone: "Asia/Ho_Chi_Minh",
                services: [{ id: "s1", name: "Head spa", durationMin: 60, priceVnd: 150_000, slots: [SLOT] }],
            },
            tools: [{ id: TOOL.recordCreate, answer: refused("declined") }],
            agent: [
                {
                    answer: {
                        reply: "We have noted 9:00 for you, Hoa.",
                        choice: {
                            serviceId: "s1",
                            startAt: SLOT.startAt,
                            resourceId: "r1",
                            customerName: "Hoa",
                            customerPhone: null,
                            partySize: 1,
                            note: "",
                        },
                    },
                },
            ],
            output: { branch: "declined", bookingId: null, declined: true, transcript: ["customer: 9:00 is fine, my name is Hoa"] },
        })
        expect(mismatches).toEqual([])

        // Version 6 (the booking as one run): `declined` ends the talk's round; after the talk an exact `if` on the book step's branch
        // reaches the team notice (design change, stated: the route no longer points at the notice from inside the loop).
        // Version 8 (R33): `asked` ends the round too (the next round starts at the wait); `off` goes to the round test.
        expect(stepOf("book")).toMatchObject({ kind: "node", loop: "talk", routes: { off: "off-round" } })
        expect(stepOf("declined-said")).toMatchObject({ kind: "if", routes: { yes: "book-declined-notice" } })
        expect(stepOf("book-declined-notice")).toMatchObject({ kind: "node", next: "declined" })
        expect(stepOf("declined")).toMatchObject({ kind: "outcome", params: { outcome: "declined" } })
    })

    it("booking.confirm-notify: a declined post RETURNS result `declined`; an `if` on that data reaches the outcome `declined`", async () => {
        const mismatches = await templateExampleMismatches(bookingConfirmNotifyNode, {
            name: "the post declined",
            params: {},
            input: { title: "Booking confirmed", text: "Hoa, 9:00 Monday" },
            tools: [{ id: TOOL.teamMessagePost, answer: refused("declined") }],
            output: { result: "declined" },
        })
        expect(mismatches).toEqual([])

        expect(stepOf("notify")).toMatchObject({ kind: "node", next: "notify-declined" })
        expect(stepOf("notify-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.notify.output.result" }, value: "declined" } },
            routes: { yes: "declined", no: "booked" },
        })
    })

    it("the same runner DOES report a node that ends in ctx.fail (another refusal): the checks above can fail", async () => {
        const mismatches = await templateExampleMismatches(bookingConfirmNotifyNode, {
            name: "another refusal",
            params: {},
            input: { title: "Booking confirmed", text: "Hoa, 9:00 Monday" },
            tools: [{ id: TOOL.teamMessagePost, answer: refused("room_closed") }],
            output: { result: "declined" },
        })
        expect(mismatches).not.toEqual([])
    })
})
