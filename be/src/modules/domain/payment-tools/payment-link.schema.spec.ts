import { LINK_CREATE_SCHEMA } from "./payment-link.schema"

const LINK = { amountVnd: 150_000, description: "Order 12", returnUrl: "https://shop.example/back", cancelUrl: "https://shop.example/cancel" }

describe("the payment link create schema", () => {
    it("takes an expiry moment and refuses one past 64 characters", () => {
        const schema = LINK_CREATE_SCHEMA
        expect(schema.safeParse({ ...LINK, expiresAt: "2026-11-20T09:00:00+07:00" }).success).toBe(true)
        expect(schema.safeParse({ ...LINK, expiresAt: `2026-11-20T09:00:00.${"1".repeat(60)}+07:00` }).success).toBe(false)
    })
})
