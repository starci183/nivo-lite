import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AdminDirectoryReadsService } from "./admin-directory-reads.service"

/** The statements `callDbFunction` runs for the database functions. */
const WORKSPACE_STATS = "SELECT * FROM public.admin_workspace_stats()"
const USER_EMAILS = "SELECT * FROM be_access.user_emails($1)"
const QUOTA_STATUS = "SELECT * FROM public.ai_quota_status($1)"
const SIGNUPS = "SELECT * FROM public.admin_signups_per_day($1)"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AdminDirectoryReadsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AdminDirectoryReadsService)
}

/** The reads that take no argument and the bound of the rows each one answers. */
const BOUNDED: ReadonlyArray<
    readonly [
        (
            | "workspaces"
            | "moduleInstalls"
            | "liveConnections"
            | "recentTransfers"
            | "recentBillingEvents"
            | "recentErrors"
        ),
        number,
    ]
> = [
    ["workspaces", 1000],
    ["moduleInstalls", 5000],
    ["liveConnections", 5000],
    ["recentTransfers", 25],
    ["recentBillingEvents", 25],
    ["recentErrors", 50],
]

/** The reads scoped to a workspace and the bound of the rows each one answers. */
const SCOPED: ReadonlyArray<
    readonly [
        (
            | "members"
            | "pendingInvites"
            | "orders"
            | "billingEvents"
            | "installs"
            | "contextVersions"
            | "agentSync"
            | "connections"
            | "workspaceErrors"
            | "knowledgeSources"
        ),
        number,
    ]
> = [
    ["members", 500],
    ["pendingInvites", 200],
    ["orders", 30],
    ["billingEvents", 20],
    ["installs", 50],
    ["contextVersions", 500],
    ["agentSync", 50],
    ["connections", 200],
    ["workspaceErrors", 20],
    ["knowledgeSources", 5000],
]

describe("AdminDirectoryReadsService bounds", () => {
    it.each(BOUNDED)("bounds the %s read at %d rows", async (method, bound) => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [] }])
        const service = await build(em)

        await expect(service[method]()).resolves.toEqual([])
        expect(read?.argsOf("limit")).toEqual([[bound]])
    })

    it.each(SCOPED)("scopes the %s read to the workspace and bounds it at %d rows", async (method, bound) => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [] }])
        const service = await build(em)

        await expect(service[method]("ws-1")).resolves.toEqual([])
        expect(read?.argsOf("where")).toContainEqual([
            expect.stringContaining(".workspace_id = :workspaceId"),
            { workspaceId: "ws-1" },
        ])
        expect(read?.argsOf("limit")).toEqual([[bound]])
    })
})

describe("AdminDirectoryReadsService single rows and guards", () => {
    it("reads one workspace by id and answers undefined when it is gone", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawOne: undefined }])
        const service = await build(em)

        await expect(service.workspace("ws-1")).resolves.toBeUndefined()
        expect(read?.argsOf("where")).toContainEqual(["w.id = :id", { id: "ws-1" }])
        expect(read?.argsOf("limit")).toEqual([[1]])
    })

    it("reads the own credit allowance of one workspace", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawOne: { credits_limit: "2000" } }])
        const service = await build(em)

        await expect(service.quotaOverride("ws-1")).resolves.toEqual({ credits_limit: "2000" })
        expect(read?.argsOf("limit")).toEqual([[1]])
    })

    it("reads the transfers of the given orders, newest first, and nothing for no orders", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ sepay_id: "7" }] }])
        const service = await build(em)

        await expect(service.transfers([])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        await expect(service.transfers(["ord-1"])).resolves.toEqual([{ sepay_id: "7" }])
        expect(read?.argsOf("where")).toContainEqual(["t.matched_order_id IN (:...orderIds)", { orderIds: ["ord-1"] }])
        expect(read?.argsOf("limit")).toEqual([[30]])
    })

    it("asks for the names of no workspaces without reading", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "ws-1", name: "Spa" }] }])
        const service = await build(em)

        await expect(service.workspaceNames([])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        await expect(service.workspaceNames(["ws-1"])).resolves.toEqual([{ id: "ws-1", name: "Spa" }])
        expect(read?.argsOf("limit")).toEqual([[500]])
    })

    it("counts the errors since an instant by scope, most first", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ key: "api.x", count: 2 }] }])
        const service = await build(em)
        const since = new Date("2026-10-12T00:00:00.000Z")

        await expect(service.errorScopes(since)).resolves.toEqual([{ key: "api.x", count: 2 }])
        expect(read?.argsOf("where")).toContainEqual(["e.created_at >= :since", { since }])
        expect(read?.argsOf("orderBy")).toEqual([["count", "DESC"]])
        expect(read?.argsOf("limit")).toEqual([[100]])
    })
})

describe("AdminDirectoryReadsService database functions", () => {
    it("reads the counts of every workspace and keeps the rows of one for its activity", async () => {
        const em = mockEntityManager({
            query: [
                WORKSPACE_STATS,
                [
                    {
                        workspace_id: "ws-0",
                        members: 1,
                        last_customer_message_at: null,
                        messages_7d: 0,
                        open_decisions: 0,
                    },
                    {
                        workspace_id: "ws-1",
                        members: 3,
                        last_customer_message_at: "2026-10-12",
                        messages_7d: 4,
                        open_decisions: 1,
                    },
                ],
            ],
        })
        const service = await build(em)

        await expect(service.workspaceStats()).resolves.toHaveLength(2)
        await expect(service.workspaceActivity("ws-1")).resolves.toEqual({
            messages_7d: 4,
            last_customer_message_at: "2026-10-12",
            open_decisions: 1,
        })
        await expect(service.workspaceActivity("ws-9")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(WORKSPACE_STATS, [])
    })

    it("reads the Auth emails of the given accounts", async () => {
        const em = mockEntityManager({ query: [USER_EMAILS, [{ id: "u-1", email: "a@b.c" }]] })
        const service = await build(em)

        await expect(service.userEmails(["u-1"])).resolves.toEqual([{ id: "u-1", email: "a@b.c" }])
        expect(em.query).toHaveBeenCalledWith(USER_EMAILS, [["u-1"]])
    })

    it("reads this month's quota of a workspace and none when the function answers nothing", async () => {
        const em = mockEntityManager({
            query: [[QUOTA_STATUS, [{ credits_used: "1", credits_limit: "2", cost_usd: "0.1", period_start: "x" }]]],
        })
        const service = await build(em)

        await expect(service.quotaStatus("ws-1")).resolves.toEqual({
            credits_used: "1",
            credits_limit: "2",
            cost_usd: "0.1",
        })
        expect(em.query).toHaveBeenCalledWith(QUOTA_STATUS, ["ws-1"])
    })

    it("reads the sign-ups of the last 14 days as calendar day text", async () => {
        const em = mockEntityManager({
            query: [
                SIGNUPS,
                [
                    { day: new Date(2026, 9, 11), signups: 3 },
                    { day: "2026-10-12", signups: 1 },
                ],
            ],
        })
        const service = await build(em)

        await expect(service.signups()).resolves.toEqual([
            { day: "2026-10-11", signups: 3 },
            { day: "2026-10-12", signups: 1 },
        ])
        expect(em.query).toHaveBeenCalledWith(SIGNUPS, [14])
    })
})
