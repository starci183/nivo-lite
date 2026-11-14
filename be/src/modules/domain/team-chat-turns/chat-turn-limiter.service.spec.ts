import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import { TEAM_CHAT_TURNS_OPTIONS } from "./team-chat-turns.decorators"
import type { ChatTurnLimit } from "./team-chat-turns.contracts"

const AT = new Date("2026-11-11T10:00:00.000Z")

/** The limit of the spec when a case names none: two turns per minute. */
const DEFAULT_LIMIT: ChatTurnLimit = { turns: 2, windowMs: 60_000 }

const build = async (limit?: ChatTurnLimit) => {
    const clock = new FakeClock(AT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatTurnLimiterService,
            { provide: CLOCK, useValue: clock },
            { provide: TEAM_CHAT_TURNS_OPTIONS, useValue: { limit: limit ?? DEFAULT_LIMIT } },
        ],
    }).compile()
    return { limiter: moduleRef.get(ChatTurnLimiterService), clock }
}

describe("ChatTurnLimiterService", () => {
    it("runs the turns under the limit, says the pause once, stays quiet, and runs again once the window frees a place", async () => {
        const { limiter, clock } = await build()

        expect([limiter.admit("ws-1:room"), limiter.admit("ws-1:room"), limiter.admit("ws-1:room"), limiter.admit("ws-1:room")]).toEqual([
            "run",
            "run",
            "pause_notice",
            "quiet",
        ])

        clock.advance(61_000)
        expect(limiter.admit("ws-1:room")).toBe("run")
    })

    it("counts each room on its own", async () => {
        const { limiter } = await build({ turns: 1, windowMs: 60_000 })

        expect(limiter.admit("ws-1:a")).toBe("run")
        expect(limiter.admit("ws-1:b")).toBe("run")
        expect(limiter.admit("ws-1:a")).toBe("pause_notice")
    })
})
