import { Test } from "@nestjs/testing"
import type { AgentWorkState } from "@modules/domain/agent-work"
import {
    internalTimeoutMsOf,
    proposalTextOf,
    stateBlockOf,
    storedProposalOf,
    usageKindFor,
    vietnamDayOf,
} from "./agent-turn.policy"

const SUBJECT = Symbol("agent-turn.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    internalTimeoutMsOf,
                    proposalTextOf,
                    stateBlockOf,
                    storedProposalOf,
                    usageKindFor,
                    vietnamDayOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        internalTimeoutMsOf: typeof internalTimeoutMsOf
        proposalTextOf: typeof proposalTextOf
        stateBlockOf: typeof stateBlockOf
        storedProposalOf: typeof storedProposalOf
        usageKindFor: typeof usageKindFor
        vietnamDayOf: typeof vietnamDayOf
    }>(SUBJECT)
}

const NOW = new Date("2026-11-10T03:00:00.000Z")

const state = (over: Partial<AgentWorkState> = {}): AgentWorkState => ({
    agentId: "agent-1",
    workEnabled: true,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
    ...over,
})

describe("agent turn policy > usage kind and time limits", () => {
    it("meters a customer turn as a chat reply and every other turn as agent work", async () => {
        const subject = await build()

        expect(subject.usageKindFor("customer")).toBe("chat_reply")
        expect(subject.usageKindFor("tag")).toBe("agent_work")
        expect(subject.usageKindFor("internal")).toBe("agent_work")
        expect(subject.usageKindFor("schedule")).toBe("agent_work")
    })

    it("gives a tag 60 seconds and background work 120", async () => {
        const subject = await build()

        expect(subject.internalTimeoutMsOf("tag")).toBe(60_000)
        expect(subject.internalTimeoutMsOf("internal")).toBe(120_000)
        expect(subject.internalTimeoutMsOf("schedule")).toBe(120_000)
    })

    it("counts the day in Vietnam time", async () => {
        const subject = await build()

        expect(subject.vietnamDayOf(new Date("2026-11-10T16:59:00.000Z"))).toBe("2026-11-10")
        expect(subject.vietnamDayOf(new Date("2026-11-10T17:00:00.000Z"))).toBe("2026-11-11")
    })
})

describe("agent turn policy > stateBlockOf", () => {
    const open = new Date(NOW.getTime() + 60_000)
    const lapsed = new Date(NOW.getTime() - 60_000)

    it("lets every source through a healthy agent", async () => {
        const subject = await build()

        for (const source of ["customer", "tag", "internal", "schedule"] as const) {
            expect(subject.stateBlockOf(source, state(), 200, NOW)).toBeNull()
        }
    })

    it("holds customer and background turns while the breaker is open, and never a tag", async () => {
        const subject = await build()
        const tripped = state({ breakerUntil: open })

        expect(subject.stateBlockOf("customer", tripped, 200, NOW)).toBe("breaker")
        expect(subject.stateBlockOf("internal", tripped, 200, NOW)).toBe("breaker")
        expect(subject.stateBlockOf("schedule", tripped, 200, NOW)).toBe("breaker")
        expect(subject.stateBlockOf("tag", tripped, 200, NOW)).toBeNull()
    })

    it("lets a turn run once the breaker has lapsed", async () => {
        const subject = await build()

        expect(subject.stateBlockOf("customer", state({ breakerUntil: lapsed }), 200, NOW)).toBeNull()
    })

    it("stops background turns at the day's cap and no other source", async () => {
        const subject = await build()
        const spent = state({ backgroundDay: "2026-11-10", backgroundTurns: 5 })

        expect(subject.stateBlockOf("internal", spent, 5, NOW)).toBe("daily_cap")
        expect(subject.stateBlockOf("schedule", spent, 5, NOW)).toBe("daily_cap")
        expect(subject.stateBlockOf("customer", spent, 5, NOW)).toBeNull()
        expect(subject.stateBlockOf("tag", spent, 5, NOW)).toBeNull()
        expect(subject.stateBlockOf("internal", spent, 6, NOW)).toBeNull()
    })

    it("does not count a cap of another day", async () => {
        const subject = await build()

        expect(
            subject.stateBlockOf("internal", state({ backgroundDay: "2026-11-09", backgroundTurns: 99 }), 5, NOW),
        ).toBeNull()
    })

    it("reports the breaker before the cap", async () => {
        const subject = await build()

        expect(
            subject.stateBlockOf(
                "internal",
                state({ breakerUntil: open, backgroundDay: "2026-11-10", backgroundTurns: 9 }),
                5,
                NOW,
            ),
        ).toBe("breaker")
    })
})

describe("agent turn policy > the stored proposal", () => {
    it("keeps the model's text and reads it back", async () => {
        const subject = await build()

        expect(subject.proposalTextOf(subject.storedProposalOf("hello"))).toBe("hello")
    })

    it("reads an empty text from anything that holds none", async () => {
        const subject = await build()

        expect(subject.proposalTextOf(null)).toBe("")
        expect(subject.proposalTextOf("text")).toBe("")
        expect(subject.proposalTextOf({})).toBe("")
        expect(subject.proposalTextOf({ text: 4 })).toBe("")
    })
})
