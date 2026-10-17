import { Test } from "@nestjs/testing"
import {
    iso,
    isoOrNull,
    toMember,
    toInvite,
    toOrder,
    toTransfer,
    toBillingEvent,
    toConnection,
    toError,
    toSignupDay,
    toPlatformTransfer,
    toPlatformBillingEvent,
    toPlatformError,
} from "./platform-admin.mapper"

const SUBJECT = Symbol("platform-admin.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    iso,
                    isoOrNull,
                    toMember,
                    toInvite,
                    toOrder,
                    toTransfer,
                    toBillingEvent,
                    toConnection,
                    toError,
                    toSignupDay,
                    toPlatformTransfer,
                    toPlatformBillingEvent,
                    toPlatformError,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./platform-admin.mapper")>(SUBJECT)
}

const AT = "2026-10-11T08:00:00.000Z"
const NOW = Date.parse("2026-10-12T00:00:00.000Z")

describe("platform-admin mapper", () => {
    it("writes instants as ISO text, from text or from a date, and keeps a missing one missing", async () => {
        const subject = await build()

        expect(subject.iso("2026-10-11 08:00:00+00")).toBe(AT)
        expect(subject.isoOrNull(null)).toBeNull()
        expect(subject.isoOrNull(AT)).toBe(AT)
    })
})

describe("platform-admin mapper", () => {
    it("maps a member with the email Auth knows", async () => {
        const subject = await build()

        expect(
            subject.toMember(
                { user_id: "u", role: "owner", display_name: "Mai", status: "active", created_at: AT },
                "m@x.vn",
            ),
        ).toEqual({
            userId: "u",
            role: "owner",
            displayName: "Mai",
            status: "active",
            email: "m@x.vn",
        })
    })
})

describe("platform-admin mapper", () => {
    it("maps a pending invitation", async () => {
        const subject = await build()

        expect(subject.toInvite({ id: "i", email: "a@x.vn", role: "staff", created_at: AT, expires_at: AT })).toEqual({
            id: "i",
            email: "a@x.vn",
            role: "staff",
            createdAt: AT,
            expiresAt: AT,
        })
    })
})

describe("platform-admin mapper", () => {
    it.each([
        ["paid", AT],
        ["open", null],
    ])("maps a %s order, its amount arriving as text", async (_name, paidAt) => {
        const subject = await build()

        expect(
            subject.toOrder({
                id: "o",
                order_code: "NIVO1",
                plan_code: "pro",
                amount_vnd: "590000",
                status: "pending",
                created_at: AT,
                paid_at: paidAt,
            }),
        ).toEqual({
            id: "o",
            orderCode: "NIVO1",
            planCode: "pro",
            amountVnd: 590000,
            status: "pending",
            createdAt: AT,
            paidAt,
        })
    })
})

describe("platform-admin mapper", () => {
    it("maps a transfer with and without an amount", async () => {
        const subject = await build()

        expect(
            subject.toTransfer({
                sepay_id: "9",
                transfer_amount: "590000",
                content: "NIVO1",
                status: "paid",
                received_at: AT,
            }),
        ).toEqual({
            sepayId: 9,
            transferAmount: 590000,
            content: "NIVO1",
            status: "paid",
            receivedAt: AT,
        })
        expect(
            subject.toTransfer({
                sepay_id: 10,
                transfer_amount: null,
                content: null,
                status: "ignored",
                received_at: AT,
            }).transferAmount,
        ).toBeNull()
    })
})

describe("platform-admin mapper", () => {
    it("maps a billing event", async () => {
        const subject = await build()

        expect(subject.toBillingEvent({ id: "b", kind: "paid", created_at: AT })).toEqual({
            id: "b",
            kind: "paid",
            createdAt: AT,
        })
    })
})

describe("platform-admin mapper", () => {
    it.each([
        ["a stored environment", "test", "test"],
        ["no environment", null, "live"],
    ])("maps a connection with %s and judges its health", async (_name, environment, shown) => {
        const subject = await build()

        expect(
            subject.toConnection(
                {
                    id: "c",
                    provider: "telegram",
                    name: "Bot",
                    status: "error",
                    environment,
                    last_event_at: null,
                    last_error: "boom",
                    created_at: AT,
                },
                NOW,
            ),
        ).toEqual({
            id: "c",
            provider: "telegram",
            name: "Bot",
            status: "error",
            environment: shown,
            lastEventAt: null,
            lastError: "boom",
            health: "error",
        })
    })
})

describe("platform-admin mapper", () => {
    it("maps an error", async () => {
        const subject = await build()

        expect(subject.toError({ id: "e", scope: "api.x", message: "m", created_at: AT })).toEqual({
            id: "e",
            scope: "api.x",
            message: "m",
            createdAt: AT,
        })
    })
})

describe("platform-admin mapper", () => {
    it("maps the health rows", async () => {
        const subject = await build()

        expect(subject.toSignupDay({ day: "2026-10-11", signups: 4 })).toEqual({ day: "2026-10-11", signups: 4 })
        expect(
            subject.toPlatformTransfer({ status: "paid", transfer_amount: "5", content: null, received_at: AT }),
        ).toEqual({
            status: "paid",
            transferAmount: 5,
            content: null,
            receivedAt: AT,
        })
        expect(subject.toPlatformBillingEvent({ id: "b", workspace_id: "w", kind: "paid", created_at: AT })).toEqual({
            id: "b",
            workspaceId: "w",
            kind: "paid",
            createdAt: AT,
        })
        expect(
            subject.toPlatformError({ id: "e", scope: "s", message: "m", workspace_id: null, created_at: AT }),
        ).toEqual({
            id: "e",
            scope: "s",
            message: "m",
            workspaceId: null,
            createdAt: AT,
        })
    })
})
