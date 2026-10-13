import {
    iso,
    isoOrNull,
    toBillingEvent,
    toConnection,
    toError,
    toInvite,
    toMember,
    toOrder,
    toPlatformBillingEvent,
    toPlatformError,
    toPlatformTransfer,
    toSignupDay,
    toTransfer,
} from "./platform-admin.mapper"

const AT = "2026-10-11T08:00:00.000Z"
const NOW = Date.parse("2026-10-12T00:00:00.000Z")

describe("platform-admin mapper", () => {
    it("writes instants as ISO text, from text or from a date, and keeps a missing one missing", () => {
        expect(iso("2026-10-11 08:00:00+00")).toBe(AT)
        expect(isoOrNull(null)).toBeNull()
        expect(isoOrNull(AT)).toBe(AT)
    })

    it("maps a member with the email Auth knows", () => {
        expect(
            toMember({ user_id: "u", role: "owner", display_name: "Mai", status: "active", created_at: AT }, "m@x.vn"),
        ).toEqual({
            userId: "u",
            role: "owner",
            displayName: "Mai",
            status: "active",
            email: "m@x.vn",
        })
    })

    it("maps a pending invitation", () => {
        expect(toInvite({ id: "i", email: "a@x.vn", role: "staff", created_at: AT, expires_at: AT })).toEqual({
            id: "i",
            email: "a@x.vn",
            role: "staff",
            createdAt: AT,
            expiresAt: AT,
        })
    })

    it.each([
        ["paid", AT],
        ["open", null],
    ])("maps a %s order, its amount arriving as text", (_name, paidAt) => {
        expect(
            toOrder({
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

    it("maps a transfer with and without an amount", () => {
        expect(
            toTransfer({ sepay_id: "9", transfer_amount: "590000", content: "NIVO1", status: "paid", received_at: AT }),
        ).toEqual({
            sepayId: 9,
            transferAmount: 590000,
            content: "NIVO1",
            status: "paid",
            receivedAt: AT,
        })
        expect(
            toTransfer({ sepay_id: 10, transfer_amount: null, content: null, status: "ignored", received_at: AT })
                .transferAmount,
        ).toBeNull()
    })

    it("maps a billing event", () => {
        expect(toBillingEvent({ id: "b", kind: "paid", created_at: AT })).toEqual({
            id: "b",
            kind: "paid",
            createdAt: AT,
        })
    })

    it.each([
        ["a stored environment", "test", "test"],
        ["no environment", null, "live"],
    ])("maps a connection with %s and judges its health", (_name, environment, shown) => {
        expect(
            toConnection(
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

    it("maps an error", () => {
        expect(toError({ id: "e", scope: "api.x", message: "m", created_at: AT })).toEqual({
            id: "e",
            scope: "api.x",
            message: "m",
            createdAt: AT,
        })
    })

    it("maps the health rows", () => {
        expect(toSignupDay({ day: "2026-10-11", signups: 4 })).toEqual({ day: "2026-10-11", signups: 4 })
        expect(toPlatformTransfer({ status: "paid", transfer_amount: "5", content: null, received_at: AT })).toEqual({
            status: "paid",
            transferAmount: 5,
            content: null,
            receivedAt: AT,
        })
        expect(toPlatformBillingEvent({ id: "b", workspace_id: "w", kind: "paid", created_at: AT })).toEqual({
            id: "b",
            workspaceId: "w",
            kind: "paid",
            createdAt: AT,
        })
        expect(toPlatformError({ id: "e", scope: "s", message: "m", workspace_id: null, created_at: AT })).toEqual({
            id: "e",
            scope: "s",
            message: "m",
            workspaceId: null,
            createdAt: AT,
        })
    })
})
