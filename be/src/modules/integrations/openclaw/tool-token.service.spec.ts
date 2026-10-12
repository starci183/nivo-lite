import { createHmac, hkdfSync } from "node:crypto"
import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { OPENCLAW_OPTIONS } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"
import { ToolTokenService } from "./tool-token.service"

const SECRET = "a-long-shared-secret"

/** A token the way the service signs it, for a body the service would never mint. */
const signed = (value: string): string => {
    const key = Buffer.from(hkdfSync("sha256", SECRET, "", "tool-token:v1", 32))
    const body = Buffer.from(value).toString("base64url")
    return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`
}

const claims = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

const build = async (toolSecret: Secret | null = new Secret(SECRET)) => {
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const options = { toolSecret } as OpenclawOptions
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolTokenService,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { tokens: moduleRef.get(ToolTokenService), clock }
}

describe("ToolTokenService", () => {
    describe("mint and verify", () => {
        it("answers the claims of a token minted for a running job", async () => {
            const { tokens } = await build()

            const token = tokens.mint(claims, 60)

            expect(tokens.verify(token ?? undefined)).toEqual({ ...claims, exp: 1_791_799_260 })
        })

        it("mints nothing and verifies nothing without a secret", async () => {
            const { tokens } = await build(null)

            expect(tokens.mint(claims, 60)).toBeNull()
            expect(tokens.verify("a.b")).toBeNull()
        })

        it("refuses a missing, malformed or forged token", async () => {
            const { tokens } = await build()
            const token = tokens.mint(claims, 60) as string
            const [body = "", mac = ""] = token.split(".")

            expect(tokens.verify(undefined)).toBeNull()
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

            expect(tokens.verify(other.tokens.mint(claims, 60) ?? undefined)).toBeNull()
        })

        it("refuses a signed token whose body is not claims", async () => {
            const { tokens } = await build()

            expect(tokens.verify(signed("not json"))).toBeNull()
            expect(tokens.verify(signed(JSON.stringify({ jobId: "j" })))).toBeNull()
        })

        it("refuses an expired token", async () => {
            const { tokens, clock } = await build()
            const token = tokens.mint(claims, 60)

            clock.advance(61_000)

            expect(tokens.verify(token ?? undefined)).toBeNull()
        })

        it("refuses a token of a job that ended", async () => {
            const { tokens } = await build()
            const token = tokens.mint(claims, 60)

            tokens.revoke("job-1")

            expect(tokens.verify(token ?? undefined)).toBeNull()
        })

        it("caps the calls one job's token may make", async () => {
            const { tokens } = await build()
            const token = tokens.mint(claims, 600) as string

            const answers = Array.from({ length: 26 }, () => tokens.verify(token))

            expect(answers.slice(0, 25).every((answer) => answer !== null)).toBe(true)
            expect(answers[25]).toBeNull()
        })
    })
})
