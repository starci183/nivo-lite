import { createHmac, hkdfSync } from "node:crypto"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OPENCLAW_OPTIONS } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"
import { ToolTokenService } from "./tool-token.service"

const SECRET = "a-long-shared-secret"
const subject = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

/** A token the way the service signs it, for a body the service would never mint. */
const signed = (value: string): string => {
    const key = Buffer.from(hkdfSync("sha256", SECRET, "", "tool-token:v1", 32))
    const body = Buffer.from(value).toString("base64url")
    return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`
}

const build = async (toolSecret: Secret | null = new Secret(SECRET)) => {
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolTokenService,
            {
                provide: OPENCLAW_OPTIONS,
                useValue: builder<OpenclawOptions>({
                    gateway: null,
                    turnTimeoutMs: 90_000,
                    settleMs: 3000,
                    configDir: undefined,
                    gatewayStateDir: "/home/node/.openclaw",
                    manageAgents: false,
                    toolSecret: null,
                })({ toolSecret }),
            },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { tokens: moduleRef.get(ToolTokenService), clock, logger }
}

describe("ToolTokenService", () => {
    it("answers the claims of a token minted for a running job", async () => {
        const { tokens } = await build()

        expect(tokens.verify(tokens.mint(subject, 60))).toEqual({ ...subject, exp: 1_791_799_260 })
    })

    it("mints nothing and verifies nothing without a secret", async () => {
        const { tokens } = await build(null)

        expect(tokens.mint(subject, 60)).toBe("")
        expect(tokens.verify("a.b")).toBeNull()
    })

    it("refuses a missing, malformed or forged token", async () => {
        const { tokens } = await build()
        const [body = "", mac = ""] = tokens.mint(subject, 60).split(".")

        expect(tokens.verify("")).toBeNull()
        expect(tokens.verify(body)).toBeNull()
        expect(tokens.verify(`${body}.`)).toBeNull()
        expect(tokens.verify(`.${mac}`)).toBeNull()
        expect(tokens.verify(`${body}.${mac.slice(0, -1)}`)).toBeNull()
        expect(tokens.verify(`${body}.${"A".repeat(mac.length)}`)).toBeNull()
    })

    it("refuses a token signed with another secret", async () => {
        const other = await build(new Secret("another-long-shared-secret"))
        const { tokens } = await build()

        expect(tokens.verify(other.tokens.mint(subject, 60))).toBeNull()
    })

    it("refuses a signed token whose body is not claims", async () => {
        const { tokens, logger } = await build()

        expect(tokens.verify(signed("not json"))).toBeNull()
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(tokens.verify(signed('"text"'))).toBeNull()
        expect(tokens.verify(signed(JSON.stringify({ jobId: "j" })))).toBeNull()
    })

    it("refuses an expired token", async () => {
        const { tokens, clock } = await build()
        const token = tokens.mint(subject, 60)

        clock.advance(61_000)

        expect(tokens.verify(token)).toBeNull()
    })

    it("refuses a token of a job that ended", async () => {
        const { tokens } = await build()
        const token = tokens.mint(subject, 60)

        tokens.revoke("job-1")

        expect(tokens.verify(token)).toBeNull()
    })

    it("caps the calls one job's token may make", async () => {
        const { tokens } = await build()
        const token = tokens.mint(subject, 600)

        const answers = Array.from({ length: 26 }, () => tokens.verify(token))

        expect(answers.slice(0, 25).every((answer) => answer !== null)).toBe(true)
        expect(answers[25]).toBeNull()
    })
})

describe("ToolTokenService authentication", () => {
    it("authenticates without consuming a call, while retaining expiry, revocation and exhaustion", async () => {
        const { tokens, clock } = await build()
        const token = tokens.mint(subject, 600)

        for (let call = 0; call < 25; call += 1) {
            expect(tokens.verify(token, false)).not.toBeNull()
            expect(tokens.verify(token)).not.toBeNull()
        }
        expect(tokens.verify(token, false)).toBeNull()

        const fresh = tokens.mint(subject, 1)
        clock.advance(2000)
        expect(tokens.verify(fresh, false)).toBeNull()
        const revoked = tokens.mint(subject, 600)
        tokens.revoke(subject.jobId)
        expect(tokens.verify(revoked, false)).toBeNull()
        expect(tokens.verify("forged.token", false)).toBeNull()
    })
})
