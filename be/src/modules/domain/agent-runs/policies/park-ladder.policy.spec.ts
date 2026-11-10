import { Test } from "@nestjs/testing"
import {
    CHAT_PARK_LADDER_SECONDS,
    chatRungSeconds,
    parkAgeSeconds,
    resumeGapSeconds,
    servesCustomer,
    supersededBy,
} from "./park-ladder.policy"
import type { SupersedeRun } from "./park-ladder.policy"

const SUBJECT = Symbol("park-ladder.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { chatRungSeconds, parkAgeSeconds, resumeGapSeconds, servesCustomer, supersededBy },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./park-ladder.policy")>(SUBJECT)
}

const BASE = 30 * 60

describe("servesCustomer", () => {
    it("is a chat run when the trigger names a conversation on a customer channel", async () => {
        const { servesCustomer } = await buildSubject()
        expect(servesCustomer({ conversationId: "c1", channel: "zalo" })).toBe(true)
        expect(servesCustomer({ conversationId: "c1", channel: "telegram" })).toBe(true)
    })

    it("is not one without a conversation, without a channel, or on a channel no customer writes from", async () => {
        const { servesCustomer } = await buildSubject()
        expect(servesCustomer({ channel: "zalo" })).toBe(false)
        expect(servesCustomer({ conversationId: "", channel: "zalo" })).toBe(false)
        expect(servesCustomer({ conversationId: "c1" })).toBe(false)
        expect(servesCustomer({ conversationId: "c1", channel: "chats-group" })).toBe(false)
        expect(servesCustomer({ conversationId: "c1", channel: "chats-group", messageId: "m1" })).toBe(false)
    })

    it("is a chat run when the context is a channel wake's: the conversation and the customer message, no channel", async () => {
        const { servesCustomer } = await buildSubject()
        expect(servesCustomer({ conversationId: "c1", messageId: "m1" })).toBe(true)
        expect(servesCustomer({ conversationId: "c1", messageId: "" })).toBe(false)
    })
})

describe("the stale consult run of the live Zalo order (2026-11-09)", () => {
    // The front desk's run of 12:30 ("toi muon mua hoa") parked and sent the holding line; the consult went on in newer runs up to the
    // order and its QR. Its context held no channel, so it was read as a back-office run: never superseded, resumed half an hour later,
    // and the customer got the consult opening again. A channel wake's context now makes it a chat run, and the newer done run closes it.
    it("closes the old parked run of a channel wake once a newer run of its agent finished in the conversation", async () => {
        const { supersededBy, parkAgeSeconds } = await buildSubject()
        const stale: SupersedeRun = {
            id: "d5f97e71",
            agentId: "front-desk",
            status: "parked",
            context: {
                messageId: "a231d98b",
                lookupName: false,
                channelEventId: "zalo:e6b1",
                conversationId: "a544428d",
            },
            startedAt: new Date("2026-11-09T05:30:39.404Z"),
        }
        const newer: SupersedeRun = {
            id: "payment-turn",
            agentId: "front-desk",
            status: "done",
            context: { messageId: "c239d406", conversationId: "a544428d" },
            startedAt: new Date("2026-11-09T05:57:08.000Z"),
        }
        expect(supersededBy(stale, [newer])).toBe(true)
        expect(parkAgeSeconds({ chat: true, resumes: 0, baseSeconds: 1800 })).toBe(60)
    })
})

describe("the chat ladder", () => {
    it("waits about a minute, then five, then half an hour for every resume after", async () => {
        const { chatRungSeconds } = await buildSubject()
        expect(CHAT_PARK_LADDER_SECONDS).toEqual([60, 300, 1800])
        expect([0, 1, 2, 3, 9].map(chatRungSeconds)).toEqual([60, 300, 1800, 1800, 1800])
    })

    it("reads the age a parked run needs from the rung of its resumes so far", async () => {
        const { parkAgeSeconds } = await buildSubject()
        expect(parkAgeSeconds({ chat: true, resumes: 0, baseSeconds: BASE })).toBe(60)
        expect(parkAgeSeconds({ chat: true, resumes: 1, baseSeconds: BASE })).toBe(300)
    })

    it("writes the next rung as the gap after a resume", async () => {
        const { resumeGapSeconds } = await buildSubject()
        expect(resumeGapSeconds({ chat: true, resumes: 0, baseSeconds: BASE })).toBe(300)
        expect(resumeGapSeconds({ chat: true, resumes: 1, baseSeconds: BASE })).toBe(1800)
    })
})

describe("any other run", () => {
    it("keeps the app's flat age and doubling gap", async () => {
        const { parkAgeSeconds, resumeGapSeconds } = await buildSubject()
        expect(parkAgeSeconds({ chat: false, resumes: 3, baseSeconds: BASE })).toBe(BASE)
        expect(resumeGapSeconds({ chat: false, resumes: 0, baseSeconds: BASE })).toBe(BASE)
        expect(resumeGapSeconds({ chat: false, resumes: 2, baseSeconds: BASE })).toBe(BASE * 4)
    })
})

describe("supersededBy", () => {
    const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 8, 21, minute))
    const run = (over: Partial<SupersedeRun> = {}): SupersedeRun => ({
        id: "old",
        agentId: "sales",
        status: "parked",
        context: { conversationId: "c-1", channel: "zalo" },
        startedAt: at(7),
        ...over,
    })

    it("is superseded once a newer run of the agent finished in the same conversation", async () => {
        const { supersededBy } = await buildSubject()
        expect(supersededBy(run(), [run({ id: "new", status: "done", startedAt: at(20) })])).toBe(true)
    })

    it("is not by an older run, an unfinished one, another agent's, another conversation's, or itself", async () => {
        const { supersededBy } = await buildSubject()
        const others = [
            run(),
            run({ id: "older", status: "done", startedAt: at(1) }),
            run({ id: "busy", status: "running", startedAt: at(20) }),
            run({ id: "other-agent", agentId: "front", status: "done", startedAt: at(20) }),
            run({
                id: "elsewhere",
                status: "done",
                startedAt: at(20),
                context: { conversationId: "c-2", channel: "zalo" },
            }),
        ]
        expect(supersededBy(run(), others)).toBe(false)
    })

    it("never supersedes a run that serves no customer conversation", async () => {
        const { supersededBy } = await buildSubject()
        const back = run({ context: { subject: "order:o-1" } })
        expect(supersededBy(back, [run({ id: "new", status: "done", startedAt: at(20), context: back.context })])).toBe(
            false,
        )
    })
})
