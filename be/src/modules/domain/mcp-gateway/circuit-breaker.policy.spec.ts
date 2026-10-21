import { Test } from "@nestjs/testing"
import { BREAKER_WINDOW_MS, BREAKER_OPEN_MS, CLOSED, breakerGate, breakerAfter } from "./circuit-breaker.policy"
import type { BreakerState } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly breakerGate: typeof breakerGate
    readonly breakerAfter: typeof breakerAfter
}

const SUBJECT = Symbol("circuit-breaker.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { breakerGate, breakerAfter },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("circuit-breaker.policy", () => {
    it("lets calls through while closed and opens after five failures in the window", async () => {
        const subject = await build()
        let state: BreakerState = CLOSED
        for (let at = 0; at < 4; at += 1) state = subject.breakerAfter(state, false, at * 1000)

        expect(state).toEqual({ phase: "closed", failures: [0, 1000, 2000, 3000], openUntil: null })
        expect(subject.breakerGate(state, 4000)).toEqual({ allowed: true, state })
        expect(subject.breakerAfter(state, false, 4000)).toEqual({
            phase: "open",
            failures: [],
            openUntil: 4000 + BREAKER_OPEN_MS,
        })
    })

    it("forgets failures older than the window", async () => {
        const subject = await build()
        let state: BreakerState = CLOSED
        for (let at = 0; at < 4; at += 1) state = subject.breakerAfter(state, false, at)

        expect(subject.breakerAfter(state, false, BREAKER_WINDOW_MS + 10)).toEqual({
            phase: "closed",
            failures: [BREAKER_WINDOW_MS + 10],
            openUntil: null,
        })
    })

    it("refuses while open, lets one probe through after the pause and refuses the others meanwhile", async () => {
        const subject = await build()
        const open: BreakerState = { phase: "open", failures: [], openUntil: 10_000 }

        expect(subject.breakerGate(open, 9_999)).toEqual({ allowed: false, state: open })
        const probe = subject.breakerGate(open, 10_000)
        expect(probe).toEqual({ allowed: true, state: { phase: "half_open", failures: [], openUntil: null } })
        expect(subject.breakerGate(probe.state, 10_001)).toEqual({ allowed: false, state: probe.state })
        expect(subject.breakerGate({ phase: "open", failures: [], openUntil: null }, 10_000).allowed).toBe(false)
    })

    it("closes on a good probe, opens again on a failed one, and stays open for a late failure", async () => {
        const subject = await build()
        const halfOpen: BreakerState = { phase: "half_open", failures: [], openUntil: null }
        const open: BreakerState = { phase: "open", failures: [], openUntil: 10_000 }

        expect(subject.breakerAfter(halfOpen, true, 20_000)).toBe(CLOSED)
        expect(subject.breakerAfter(halfOpen, false, 20_000)).toEqual({
            phase: "open",
            failures: [],
            openUntil: 20_000 + BREAKER_OPEN_MS,
        })
        expect(subject.breakerAfter(open, false, 5_000)).toBe(open)
    })
})
