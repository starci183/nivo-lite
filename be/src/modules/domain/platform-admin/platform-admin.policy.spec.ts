import { builder } from "@starci/jest-preset"
import type { AdminWorkspaceItem } from "./platform-admin.contracts"
import {
    SILENT_AFTER_MS,
    connectionHealth,
    countByWorkspace,
    creditsFrom,
    creditsOf,
    filterCounts,
    isPlatformAdmin,
    knowledgeByKind,
    matchesWorkspace,
    summarizeConnections,
    tally,
    workspaceFlags,
} from "./platform-admin.policy"

const NOW = Date.parse("2026-10-12T00:00:00.000Z")
const RECENT = "2026-10-11T00:00:00.000Z"
const STALE = new Date(NOW - SILENT_AFTER_MS - 1000).toISOString()

const itemOf = builder<AdminWorkspaceItem>({
    id: "aaaa1111-0000-4000-8000-000000000001",
    name: "Spa Hoa Mai",
    ownerEmail: "mai@nivo.vn",
    status: "active",
    planCode: "pro",
    paidUntil: null,
    createdAt: RECENT,
    members: 2,
    modules: [],
    connections: [],
    connectionWarning: false,
    lastCustomerMessageAt: null,
    messages7d: 3,
    openDecisions: 0,
    errors24h: 0,
    attention: false,
    unpaid: false,
    idle7d: false,
})

describe("platform-admin policy", () => {
    describe("isPlatformAdmin", () => {
        it("accepts a listed email whatever its case or padding", () => {
            expect(isPlatformAdmin("  Team@Nivo.VN ", ["team@nivo.vn"])).toBe(true)
        })

        it.each([["someone@else.vn"], [undefined]])("refuses %s", (email) => {
            expect(isPlatformAdmin(email, ["team@nivo.vn"])).toBe(false)
        })
    })

    describe("connectionHealth", () => {
        const facts = { status: "connected", environment: null, lastEventAt: RECENT, createdAt: STALE }

        it("is error for a connection in error", () => {
            expect(connectionHealth({ ...facts, status: "error" }, NOW)).toBe("error")
        })

        it("is ok for a live connection that spoke recently", () => {
            expect(connectionHealth(facts, NOW)).toBe("ok")
        })

        it("is silent for a live connection that went quiet", () => {
            expect(connectionHealth({ ...facts, lastEventAt: STALE }, NOW)).toBe("silent")
        })

        it("counts from the creation when it never spoke", () => {
            expect(connectionHealth({ ...facts, lastEventAt: null }, NOW)).toBe("silent")
        })

        it.each([
            ["a test connection", { environment: "test", lastEventAt: STALE }],
            ["a disconnected connection", { status: "disconnected", lastEventAt: STALE }],
        ])("never calls %s silent", (_name, change) => {
            expect(connectionHealth({ ...facts, ...change }, NOW)).toBe("ok")
        })
    })

    describe("countByWorkspace", () => {
        it("counts the rows of each workspace and leaves platform rows out", () => {
            const counts = countByWorkspace([
                { workspace_id: "a" },
                { workspace_id: null },
                { workspace_id: "a" },
                { workspace_id: "b" },
            ])

            expect([...counts.entries()]).toEqual([
                ["a", 2],
                ["b", 1],
            ])
        })
    })

    describe("summarizeConnections", () => {
        it("makes one badge per provider with its unhealthy counts", () => {
            const base = { environment: "live", createdAt: STALE }

            expect(
                summarizeConnections(
                    [
                        { ...base, provider: "telegram", status: "connected", lastEventAt: RECENT },
                        { ...base, provider: "telegram", status: "error", lastEventAt: RECENT },
                        { ...base, provider: "zalo", status: "connected", lastEventAt: STALE },
                    ],
                    NOW,
                ),
            ).toEqual([
                { provider: "telegram", count: 2, error: 1, silent: 0 },
                { provider: "zalo", count: 1, error: 0, silent: 1 },
            ])
        })
    })

    describe("workspaceFlags", () => {
        const calm = {
            status: "active",
            paidUntil: null,
            connectionWarning: false,
            errors24h: 0,
            messages7d: 1,
        }

        it("flags nothing for a calm paid workspace", () => {
            expect(workspaceFlags(calm, NOW)).toEqual({ attention: false, unpaid: false, idle7d: false })
        })

        it.each([
            ["a connection warning", { connectionWarning: true }],
            ["an error", { errors24h: 1 }],
            ["a past due status", { status: "past_due" }],
        ])("asks for attention on %s", (_name, change) => {
            expect(workspaceFlags({ ...calm, ...change }, NOW).attention).toBe(true)
        })

        it.each([
            ["pending payment", { status: "pending_payment" }],
            ["past due", { status: "past_due" }],
            ["a lapsed subscription", { paidUntil: RECENT }],
        ])("calls %s unpaid", (_name, change) => {
            expect(workspaceFlags({ ...calm, ...change }, NOW).unpaid).toBe(true)
        })

        it("does not call a cancelled lapsed workspace unpaid, nor a paid one", () => {
            expect(workspaceFlags({ ...calm, status: "cancelled", paidUntil: RECENT }, NOW).unpaid).toBe(false)
            expect(workspaceFlags({ ...calm, paidUntil: "2027-01-01T00:00:00.000Z" }, NOW).unpaid).toBe(false)
        })

        it("is idle without customer messages", () => {
            expect(workspaceFlags({ ...calm, messages7d: 0 }, NOW).idle7d).toBe(true)
        })
    })

    describe("matchesWorkspace", () => {
        it.each([
            ["attention", { attention: true }, { attention: false }],
            ["unpaid", { unpaid: true }, { unpaid: false }],
            ["idle", { idle7d: true }, { idle7d: false }],
        ] as const)("keeps only the %s workspaces", (filter, yes, no) => {
            expect(matchesWorkspace(itemOf(yes), filter, "")).toBe(true)
            expect(matchesWorkspace(itemOf(no), filter, "")).toBe(false)
        })

        it("keeps every workspace for all", () => {
            expect(matchesWorkspace(itemOf(), "all", "")).toBe(true)
        })

        it.each([
            ["name", "hoa mai"],
            ["owner email", "MAI@nivo"],
            ["id prefix", "aaaa1111"],
        ])("finds a workspace by its %s", (_name, query) => {
            expect(matchesWorkspace(itemOf(), "all", query)).toBe(true)
        })

        it("refuses a search that matches nothing, owner unknown included", () => {
            expect(matchesWorkspace(itemOf(), "all", "zzz")).toBe(false)
            expect(matchesWorkspace(itemOf({ ownerEmail: null }), "all", "zzz")).toBe(false)
        })
    })

    describe("filterCounts", () => {
        it("counts what each filter keeps", () => {
            expect(
                filterCounts([itemOf({ attention: true }), itemOf({ unpaid: true, idle7d: true }), itemOf()]),
            ).toEqual({ all: 3, attention: 1, unpaid: 1, idle: 1 })
        })
    })

    describe("knowledgeByKind", () => {
        it("groups the sources by kind with their statuses counted", () => {
            expect(
                knowledgeByKind([
                    { kind: "text", status: "ready" },
                    { kind: "text", status: "ready" },
                    { kind: "text", status: "failed" },
                    { kind: "faq", status: "ready" },
                ]),
            ).toEqual([
                { kind: "text", byStatus: { ready: 2, failed: 1 } },
                { kind: "faq", byStatus: { ready: 1 } },
            ])
        })
    })

    describe("tally", () => {
        it("counts equal values in order of first appearance", () => {
            expect(tally(["paid", "unmatched", "paid"])).toEqual([
                { key: "paid", count: 2 },
                { key: "unmatched", count: 1 },
            ])
        })
    })

    describe("credits", () => {
        it("converts a model cost to credits with two decimals", () => {
            expect(creditsOf(0.123)).toBe(30.75)
        })

        it("shows zero use and no limit for a workspace without a quota status", () => {
            expect(creditsFrom(undefined, undefined)).toEqual({ used: 0, limit: null, costUsd: 0, ownLimit: null })
        })

        it("takes the reported credits and both limits as numbers", () => {
            expect(
                creditsFrom(
                    { credits_used: "12.5", credits_limit: "1150", cost_usd: "0.05" },
                    { credits_limit: "2000" },
                ),
            ).toEqual({ used: 12.5, limit: 1150, costUsd: 0.05, ownLimit: 2000 })
        })

        it("derives the use from the cost when the status reports none, and reads an unlimited plan and an empty override", () => {
            expect(
                creditsFrom({ credits_used: null, credits_limit: null, cost_usd: 0.04 }, { credits_limit: null }),
            ).toEqual({
                used: 10,
                limit: null,
                costUsd: 0.04,
                ownLimit: null,
            })
        })
    })
})
