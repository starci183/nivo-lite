import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { frontDeskGraph } from "../../chatbot/template/front-desk.graph"
import { bookingAgent } from "./booking.agent"
import { bookingBookGraph } from "./book.graph"
import { bookingRemindGraph } from "./remind.graph"

/**
 * The Booking graphs and agent. Importing them is the first check: the builders throw at module load with every problem decidable
 * without the engine (refs, routes, reachability, accounts against the agent's providers).
 */
/** A step of the booking graph by key. */
const stepOf = (key: string) => bookingBookGraph.spec.nodes.find((step) => step.key === key)

describe("booking.book", () => {
    // Design change v8 (R33): each round after the first starts with the wait (round 1 has no event); ONE book step reads THAT round's
    // message; `off` hands it back in a round that waited and ends `not-booking` in round 1.
    it("is version 8, called by another workflow, ONE run: a talk loop (the wait from round 2, find-slots, book), then the asked confirmation", () => {
        expect(bookingBookGraph.spec.catalogue?.version).toBe(8)
        expect(bookingBookGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(bookingBookGraph.spec.nodes.map((step) => step.key)).toEqual([
            "talk",
            "opening",
            "hear",
            "slots",
            "book",
            "off-round",
            "give-back-talk",
            "settled",
            "not-booking-said",
            "not-booking",
            "declined-said",
            "book-declined-notice",
            "confirm",
            "declined-notice",
            "tell",
            "tell-declined-notice",
            "notify",
            "notify-declined",
            "booked",
            "declined",
            "quiet",
        ])
        expect(stepOf("talk")).toMatchObject({ kind: "loop" })
        expect(stepOf("hear")).toMatchObject({ loop: "talk", kind: "wait", routes: { zalo: "slots", telegram: "slots", facebook: "slots", instagram: "slots" } })
        expect(stepOf("give-back-talk")).toMatchObject({ kind: "hand-back", params: { wait: "hear" } })
        expect(JSON.stringify(stepOf("book"))).toContain('"round":"previous"')
    })

    it("takes its caller's params in the event's data: the contract's `data` states them", () => {
        const data = bookingBookGraph.spec.contract.inputs.find((input) => input.name === "data")
        expect(data?.members?.map((member) => member.name)).toEqual(["conversationId", "text", "channel", "contactId", "recentLines"])
    })

    it("splits the confirmation in three steps of ONE write each, in the old order: confirm (ask) \u2192 tell \u2192 notify \u2192 booked", () => {
        expect(stepOf("confirm")).toMatchObject({
            step: "booking.confirm",
            mode: "ask",
            routes: { confirmed: "tell", declined: "declined-notice", settled: "booked" },
        })
        expect(stepOf("tell")).toMatchObject({
            step: "booking.confirm-tell",
            mode: "auto",
            routes: { told: "notify", declined: "tell-declined-notice" },
        })
        expect(stepOf("notify")).toMatchObject({ step: "booking.confirm-notify", mode: "auto", next: "notify-declined" })
        expect(stepOf("notify-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "booked" } })
        const [confirm, tell, notify] = ["booking.confirm", "booking.confirm-tell", "booking.confirm-notify"].map((id) =>
            bookingBookGraph.nodes.get(id),
        )
        expect(confirm?.tools).toEqual([])
        expect(tell?.tools).toEqual([TOOL.customerMessageSend])
        expect(notify?.tools).toEqual([TOOL.teamMessagePost])
    })

    it("ends declined on a declined step: book, confirm and tell tell the team first; notify (itself the team's post) does not", () => {
        for (const notice of ["book-declined-notice", "declined-notice", "tell-declined-notice"]) {
            expect([notice, stepOf(notice)]).toMatchObject([notice, { step: "team.declined-notice", next: "declined" }])
        }
        expect(stepOf("declined")).toMatchObject({ kind: "outcome" })
    })
})

describe("the person of a booking", () => {
    it("is the core contact: the front desk hands it over as contactId and the book step writes it", () => {
        const handOff = JSON.stringify(frontDeskGraph.spec.nodes.find((step) => step.key === "to-booking"))
        expect(handOff).toContain("contactId")
        expect(handOff).toContain("trigger.contactId")
        expect(handOff).not.toContain("leadId")
        const book = JSON.stringify(bookingBookGraph.spec.nodes.find((step) => step.key === "book"))
        expect(book).toContain("trigger.data.contactId")
        expect(book).not.toContain("leadId")
    })

    it("reads the conversation from the recent lines the front desk hands on (the conversation read is the owning agent's)", () => {
        expect(JSON.stringify(frontDeskGraph.spec.nodes.find((step) => step.key === "to-booking"))).toContain("steps.understand.output.recentLines")
        expect(JSON.stringify(bookingBookGraph.spec.nodes.find((step) => step.key === "book"))).toContain("trigger.data.recentLines")
    })
})

describe("booking.remind", () => {
    it("is woken by the hourly clock and reminds in one step", () => {
        expect(bookingRemindGraph.spec.triggers).toEqual([{ verb: TRIGGER.clockTick, args: { preset: "hourly" } }])
        expect(bookingRemindGraph.spec.nodes.map((step) => step.key)).toEqual(["remind", "reminded"])
    })
})

describe("the Booking agent", () => {
    it("opens on the booking graph and lists the booking and the reminders only", () => {
        expect(bookingAgent.primary).toBe("booking.book")
        expect(bookingAgent.graphs.map((graph) => graph.key)).toEqual(["booking.book", "booking.remind"])
    })
})
