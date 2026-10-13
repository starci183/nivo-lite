import { Test } from "@nestjs/testing"
import * as signingPolicy from "./webhook-signing.policy"

const POLICY = Symbol("WebhookSigningPolicy")

describe("webhook signing policy", () => {
    let policy: typeof signingPolicy

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: POLICY, useValue: signingPolicy }],
        }).compile()
        policy = moduleRef.get<typeof signingPolicy>(POLICY)
    })

    describe("isWebhookEvent", () => {
        it.each([
            "lead.created",
            "deal.won",
            "order.confirmed",
            "payment.received",
            "handoff.requested",
            "decision.made",
        ])("accepts %s", (event) => {
            expect(policy.isWebhookEvent(event)).toBe(true)
        })

        it("refuses unknown strings and values that are not strings", () => {
            for (const value of [
                "",
                "lead.updated",
                "LEAD.CREATED",
                " lead.created ",
                null,
                undefined,
                42,
                false,
                {},
                [],
            ]) {
                expect(policy.isWebhookEvent(value)).toBe(false)
            }
        })
    })

    describe("pickEvents", () => {
        it("filters invalid events and keeps the first occurrence of each valid event in input order", () => {
            expect(
                policy.pickEvents([
                    "unknown",
                    "decision.made",
                    "lead.created",
                    "decision.made",
                    " lead.created ",
                    "payment.received",
                    "lead.created",
                    "order.confirmed",
                ]),
            ).toEqual(["decision.made", "lead.created", "payment.received", "order.confirmed"])
        })

        it("returns no events for an empty list or a list containing only invalid events", () => {
            expect(policy.pickEvents([])).toEqual([])
            expect(policy.pickEvents(["unknown", "", "LEAD.CREATED"])).toEqual([])
        })
    })

    describe("eventsOf", () => {
        it("trims comma-separated facts, drops invalid entries and removes duplicates in order", () => {
            expect(
                policy.eventsOf({
                    events: " deal.won , ,lead.created, unknown, deal.won ,\tpayment.received\n",
                    host: "hooks.example.com",
                }),
            ).toEqual(["deal.won", "lead.created", "payment.received"])
        })

        it("returns no events when the fact is absent or empty", () => {
            expect(policy.eventsOf({})).toEqual([])
            expect(policy.eventsOf({ events: "" })).toEqual([])
        })
    })

    describe("workspaceSigningSecret", () => {
        it.each([
            ["shared-secret", "ws-1", "e38fda3b5a2d569daedec1db5a2b22e0cde430adee9c63cc53c500d898ec67dd"],
            ["shared-secret", "ws-2", "db57a41d312824dcddb879405d4149d3a735ce2fa399905023f86c980595a1ef"],
            ["another-secret", "ws-1", "1f0d5291002ab5f1361acc2412d4942e919c4da5334254e6b44d237fd1af20a5"],
            ["", "", "a8f94efd0c22189116e326c36c8e71ffd3e001ef3e3443921418bbc9c52a862f"],
        ])(
            "derives the exact HMAC-SHA256 key for shared secret %j and workspace %j",
            (secret, workspaceId, expected) => {
                expect(policy.workspaceSigningSecret(secret, workspaceId)).toBe(expected)
            },
        )
    })

    describe("signDelivery", () => {
        it.each([
            [
                "delivery-key",
                "1791783600",
                '{"event":"lead.created"}',
                "e14485d279e9c123d4136e102cb0e3f137e1345dafc8b7dd9a3a6b6bc693b2ca",
            ],
            [
                "delivery-key",
                "1791783601",
                '{"event":"lead.created"}',
                "7575b662b3c299916b73173efab5f9dd87c897563bc18b1cc8761d1d98b4f4ea",
            ],
            [
                "delivery-key",
                "1791783600",
                ' {"event":"lead.created"}',
                "ca17512faccb7e9cccb9035d16975c6d31115fceee1d951b87c2bed97bf33039",
            ],
            [
                "another-key",
                "1791783600",
                '{"event":"lead.created"}',
                "f60ac62023c4d42eb5f806a06e087b96b2b1c511cabbe7e1e4608ef3c228bfca",
            ],
            ["", "", "", "0d0ab78babcce47b6860946aad720dcc13630f70074364b65665c4caefb81ecf"],
        ])("signs key %j, timestamp %j and the exact body %j", (key, timestamp, body, expected) => {
            expect(policy.signDelivery(key, timestamp, body)).toBe(expected)
        })
    })
})
