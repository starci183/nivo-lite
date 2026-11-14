import { Test } from "@nestjs/testing"
import type { HealthCandidate } from "@modules/domain/connections"
import { judgeConnection } from "./connection-health.policy"
const SUBJECT = Symbol("connection-health.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { judgeConnection } }],
    }).compile()
    return moduleRef.get<typeof import("./connection-health.policy")>(SUBJECT)
}

const NOW = Date.parse("2026-10-12T10:00:00.000Z")

const connection = (patch: Partial<HealthCandidate> = {}): HealthCandidate => ({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "telegram",
    name: "Bot",
    status: "connected",
    lastError: "",
    lastEventAt: "2026-10-12T09:00:00.000Z",
    createdAt: "2026-10-01T09:00:00.000Z",
    health: "",
    ...patch,
})

describe("judgeConnection needs_reauth", () => {
    it("keeps a refused credential a reconnect request while the status says error, and calls it fine once the owner connected again", async () => {
        const subject = await build()
        expect(subject.judgeConnection(connection({ health: "needs_reauth", status: "error", lastError: "Reconnect" }), NOW, 72)).toEqual({
            state: "needs_reauth",
            reason: "Reconnect",
        })
        expect(subject.judgeConnection(connection({ health: "needs_reauth", status: "connected" }), NOW, 72).state).toBe("ok")
        expect(subject.judgeConnection(connection({ status: "error", lastError: "x" }), NOW, 72).state).toBe("failing")
    })
})

describe("judgeConnection degraded", () => {
    it("keeps the degraded mark the poll scheduler set, except that an error status is failing", async () => {
        const subject = await build()
        expect(subject.judgeConnection(connection({ health: "degraded" }), NOW, 72).state).toBe("degraded")
        expect(subject.judgeConnection(connection({ health: "degraded", status: "error" }), NOW, 72).state).toBe("failing")
    })
})

describe("judgeConnection", () => {
    it("calls a connection that reports an error failing, with its words bounded", async () => {
        const subject = await build()

        expect(subject.judgeConnection(connection({ status: "error", lastError: "Reconnect" }), NOW, 72)).toEqual({
            state: "failing",
            reason: "Reconnect",
        })
        expect(
            subject.judgeConnection(connection({ status: "error", lastError: "x".repeat(300) }), NOW, 72).reason,
        ).toHaveLength(200)
        expect(subject.judgeConnection(connection({ status: "error" }), NOW, 72)).toEqual({
            state: "failing",
            reason: "connection reports an error",
        })
    })

    it(
        "calls a receiving connection silent after the allowed hours, counted from creation " +
            "when it never heard anything",
        async () => {
            const subject = await build()

            expect(subject.judgeConnection(connection({ lastEventAt: "2026-10-09T09:00:00.000Z" }), NOW, 72)).toEqual({
                state: "silent",
                reason: "no event for 73h",
            })
            expect(
                subject.judgeConnection(
                    connection({ lastEventAt: "", createdAt: "2026-10-01T09:00:00.000Z" }),
                    NOW,
                    72,
                ),
            ).toMatchObject({ state: "silent" })
        },
    )

    it(
        "calls a receiving connection with a recent event fine, and never judges silence on a " +
            "provider that sends nothing",
        async () => {
            const subject = await build()

            expect(subject.judgeConnection(connection(), NOW, 72)).toEqual({ state: "ok", reason: "" })
            expect(subject.judgeConnection(connection({ provider: "smtp", lastEventAt: "" }), NOW, 72)).toEqual({
                state: "ok",
                reason: "",
            })
        },
    )
})
