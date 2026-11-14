import { Test } from "@nestjs/testing"
import { approvalStopOf, deskBoardOf, deskRightsOf } from "@tests/fixtures/builders/agent-desk.builder"
import {
    askSourceOf,
    askerOf,
    dayWindowOf,
    reachOf,
    runFactsOf,
    runOutcomeOf,
    waitingLineOf,
    waitingRowOf,
} from "./agent-desk.mapper"
import { ABILITY_SEPARATOR } from "./platform-regions.policy"

const SUBJECT = Symbol("agent-desk.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { askSourceOf, askerOf, dayWindowOf, reachOf, runFactsOf, runOutcomeOf, waitingLineOf, waitingRowOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-desk.mapper")>(SUBJECT)
}

describe("agent desk: what waits on a person", () => {
    it("draws an approval from the facts it holds: ability, account, then each argument; its id is the owner item", async () => {
        const subject = await build()
        expect(subject.waitingRowOf(approvalStopOf(), "Anh Tu")).toEqual({
            id: "item-1",
            runId: "run-1",
            title: "Change the phone of Minh An",
            askedBy: "Anh Tu",
            askedAt: "2026-11-12T02:12:00.000Z",
            line: ["Update a contact", "NIVO Web CRM", "phone: 0903 *** 221 -> 0938 *** 407"].join(ABILITY_SEPARATOR),
            commands: ["decline", "approve"],
        })
    })

    it("offers no verdict on another stop (answered on its card) nor on an approval with no owner item", async () => {
        const subject = await build()
        const question = approvalStopOf({ kind: "ai_report", question: "Which order is this for?" })
        expect(subject.waitingRowOf(question, null)).toMatchObject({
            id: "stop-1",
            line: "Which order is this for?",
            commands: [],
        })
        const bare = approvalStopOf({
            detail: { suggestions: [], facts: [{ name: "tool", value: "nivo.api.crm.nivoweb.post.customers.code.contacts" }] },
        })
        expect(subject.waitingRowOf(bare, null)).toMatchObject({ id: "stop-1", line: "", commands: [] })
        expect(subject.waitingLineOf(approvalStopOf({ kind: "engine", question: null }))).toBe("")
    })
})

describe("agent desk: the runs", () => {
    it("tells how a run ended, a done run that changed a record from one that answered", async () => {
        const subject = await build()
        expect(subject.runOutcomeOf("done", 1)).toBe("changed")
        expect(subject.runOutcomeOf("done", 0)).toBe("answered")
        expect(subject.runOutcomeOf("done", null)).toBe("answered")
        expect(subject.runOutcomeOf("waiting", null)).toBe("stopped")
        expect(subject.runOutcomeOf("dead", null)).toBe("failed")
        expect(subject.runOutcomeOf("running", null)).toBe("running")
        expect(subject.runOutcomeOf(undefined, null)).toBe("running")
    })

    // Ruling R52: the pre-pipeline wake member `messageId` is gone (no producer writes it); a run of the one pipeline names its verb and
    // event id, and the desk reads the event's words as the run did. The old `row` source is deleted, not kept beside it (no legacy).
    it("reads the question from the pipeline event the run answers, else the words of a tag", async () => {
        const subject = await build()
        const delivered = {
            verb: "nivo.trigger.zalo.message.received",
            eventId: "zalo:msg-1",
            declaration: "zalo_oa:message.received",
            connectionId: "conn-1",
            conversationId: "c-1",
            rawType: "zalo_oa.message",
            rawRowId: "row-1",
        }
        expect(subject.askSourceOf(delivered)).toEqual({ kind: "event" })
        expect(subject.askSourceOf({ ...delivered, text: "ignored" })).toEqual({ kind: "event" })
        expect(subject.askSourceOf({ verb: "nivo.trigger.zalo.message.received" })).toEqual({ kind: "none" })
        expect(subject.askSourceOf({ text: "Record the new email of Phong" })).toEqual({
            kind: "text",
            text: "Record the new email of Phong",
        })
        expect(subject.askSourceOf({ conversationId: "c-1" })).toEqual({ kind: "none" })
        expect(subject.askSourceOf({ conversationId: "c-1", messageId: "m-1", connectionId: "conn-1" })).toEqual({ kind: "none" })
    })

    it("names who asked: the person who wrote the tag, else the agent that handed it on", async () => {
        const subject = await build()
        expect(subject.askerOf({ authorUserId: "u-1", authorAgentId: "a-2" })).toEqual({ kind: "user", userId: "u-1" })
        expect(subject.askerOf({ authorAgentId: "a-2" })).toEqual({ kind: "agent", agentId: "a-2" })
        expect(subject.askerOf({})).toEqual({ kind: "none" })
    })

    it("counts the records a run touched: none without a call, null where calls stated no count", async () => {
        const subject = await build()
        const run = { id: "run-1", status: "done" }
        expect(subject.runFactsOf(run, "Q", "Lan", undefined)).toEqual({
            runId: "run-1",
            ask: "Q",
            askedBy: "Lan",
            readCount: 0,
            changedCount: 0,
            uncounted: 0,
            outcome: "answered",
        })
        expect(subject.runFactsOf(run, null, null, { runId: "run-1", read: 4, changed: 1, uncounted: 0 })).toMatchObject({
            readCount: 4,
            changedCount: 1,
            outcome: "changed",
        })
        expect(subject.runFactsOf(run, null, null, { runId: "run-1", read: null, changed: null, uncounted: 3 })).toMatchObject({
            readCount: null,
            changedCount: null,
            uncounted: 3,
            outcome: "answered",
        })
    })
})

describe("agent desk: the workspace's day", () => {
    it("is the calendar day of the workspace's time zone, from its midnight to the next", async () => {
        const subject = await build()
        const late = subject.dayWindowOf({ timeZone: "Asia/Ho_Chi_Minh", now: new Date("2026-11-11T18:30:00.000Z") })
        expect(late).toEqual({
            day: "2026-11-12",
            from: new Date("2026-11-11T17:00:00.000Z"),
            to: new Date("2026-11-12T17:00:00.000Z"),
        })
        expect(subject.dayWindowOf({ timeZone: "UTC", now: new Date("2026-12-31T23:59:59.000Z") })).toEqual({
            day: "2026-12-31",
            from: new Date("2026-12-31T00:00:00.000Z"),
            to: new Date("2027-01-01T00:00:00.000Z"),
        })
    })

    it("follows a change of offset on the day itself", async () => {
        const subject = await build()
        const spring = subject.dayWindowOf({ timeZone: "America/New_York", now: new Date("2026-03-08T15:00:00.000Z") })
        expect(spring).toEqual({
            day: "2026-03-08",
            from: new Date("2026-03-08T05:00:00.000Z"),
            to: new Date("2026-03-09T04:00:00.000Z"),
        })
    })
})

describe("agent desk: what the agent may touch", () => {
    it("groups the operations of its running steps by mode, the offered ones no step holds as none, titles once", async () => {
        const subject = await build()
        expect(subject.reachOf(deskRightsOf(), deskBoardOf(), "en")).toEqual({
            accounts: [{ connectionId: "conn-1", name: "NIVO Web", providerName: "CRM", state: "connected" }],
            auto: ["Read customers"],
            ask: ["Update a contact"],
            none: ["Renew a service", "ticket.open"],
        })
        expect(subject.reachOf(deskRightsOf(), deskBoardOf(), "vi").auto).toEqual(["Read customers (vi)"])
    })

    it("says an account needs attention when it does not work, and is off when the agent holds nothing on it", async () => {
        const subject = await build()
        const broken = deskBoardOf()
        const provider = broken.providers[0]
        const offline = deskBoardOf({
            providers:
                provider === undefined
                    ? []
                    : [
                          {
                              ...provider,
                              accounts: provider.accounts.map((account) => ({ ...account, connected: false })),
                          },
                      ],
        })
        expect(subject.reachOf(deskRightsOf(), offline, "en").accounts[0]?.state).toBe("attention")
        expect(subject.reachOf(deskRightsOf(), deskBoardOf({ attachments: [] }), "en").accounts[0]?.state).toBe("off")
    })
})
