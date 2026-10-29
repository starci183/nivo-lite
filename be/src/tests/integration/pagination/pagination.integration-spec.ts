import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { normalizePage } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { eachInOrder } from "@modules/platform/primitives"
import { persistPaginationChange, persistPaginationRows } from "../../fixtures/builders/pagination.builder"
import type { PaginationFixture, PaginationIdentity } from "../../fixtures/builders/pagination.builder"
import { PaginationProofModule } from "../../world/pagination-proof.module"
import { useTestWorld } from "../../world/use-test-world"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: [PaginationProofModule.register()] })

/** The three main list owners share connection semantics over their own SQL statements. */
type ListName = "leadBoard" | "salesOrders" | "workThreads"

/** The row identity common to every list. */
interface ListedId {
    readonly id: string
}

const pageOf = (list: ListName, workspaceId: string, request: PageRequest): Promise<Connection<ListedId>> => {
    if (list === "leadBoard") return world.resolve(LeadReadService).listPage(workspaceId, request)
    if (list === "salesOrders") return world.resolve(OrdersService).listPage(workspaceId, request)
    return world.resolve(WorkThreadsService).list(workspaceId, null, request)
}

const scopeOf = (list: ListName, workspaceId: string): string =>
    list === "workThreads" ? `${workspaceId}:workThreads:all` : `${list}:${workspaceId}`

const seed = (): Promise<PaginationFixture> => {
    const identity: PaginationIdentity = {
        userId: world.id(),
        workspaceId: world.id(),
        foreignWorkspaceId: world.id(),
        emptyWorkspaceId: world.id(),
        rowIds: [world.id(), world.id(), world.id(), world.id()],
        foreignRowId: world.id(),
    }
    world.cleanup(async () => {
        await eachInOrder(
            [identity.workspaceId, identity.foreignWorkspaceId, identity.emptyWorkspaceId],
            async (workspaceId) => {
                await removeWorkspace(world.db.primary, workspaceId)
            },
        )
        await removeAuthUsers(world.db.primary, [identity.userId])
    })
    return persistPaginationRows(world.db.primary, identity)
}

const registerPageWalk = (): void => {
    it.each<ListName>(["leadBoard", "salesOrders", "workThreads"])(
        "%s crosses tied microsecond instants once, even when a newer row arrives",
        async (list) => {
            const identity = await seed()
            const tiedIds = [identity.rowIds[1], identity.rowIds[2]].sort((left, right) => right.localeCompare(left))
            const first = await pageOf(list, identity.workspaceId, { first: 2 })

            expect(first.nodes.map((node) => node.id)).toEqual([identity.rowIds[3], tiedIds[0]])
            expect(first.pageInfo.hasNextPage).toBe(true)
            expect(
                normalizePage({ after: first.pageInfo.endCursor }, scopeOf(list, identity.workspaceId)).after,
            ).toEqual({
                createdAt: "2026-01-01T00:00:00.123456+00:00",
                id: tiedIds[0],
            })
            expect(first.pageInfo.endCursor).not.toBe(tiedIds[0])

            const newerId = world.id()
            await persistPaginationChange(world.db.primary, identity, newerId)

            const last = await pageOf(list, identity.workspaceId, { first: 2, after: first.pageInfo.endCursor })
            expect(last.nodes.map((node) => node.id)).toEqual([tiedIds[1], identity.rowIds[0]])
            expect(last.pageInfo.hasNextPage).toBe(false)
            expect(
                normalizePage({ after: last.pageInfo.endCursor }, scopeOf(list, identity.workspaceId)).after,
            ).toEqual({
                createdAt: "2026-01-01T00:00:00.123455+00:00",
                id: identity.rowIds[0],
            })
            expect([...first.nodes, ...last.nodes].map((node) => node.id)).toEqual([
                identity.rowIds[3],
                ...tiedIds,
                identity.rowIds[0],
            ])

            const exhausted = await pageOf(list, identity.workspaceId, { first: 2, after: last.pageInfo.endCursor })
            expect(exhausted).toEqual({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } })

            const restarted = await pageOf(list, identity.workspaceId, { first: 1 })
            expect(restarted.nodes.map((node) => node.id)).toEqual([newerId])
        },
    )
}

const registerPageBounds = (): void => {
    it.each<ListName>(["leadBoard", "salesOrders", "workThreads"])(
        "%s bounds pages and isolates empty and foreign workspace results",
        async (list) => {
            const identity = await seed()
            const empty = await pageOf(list, identity.emptyWorkspaceId, { first: 2 })
            expect(empty).toEqual({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } })
            const foreign = await pageOf(list, identity.foreignWorkspaceId, { first: 2 })
            expect(foreign.nodes.map((node) => node.id)).toEqual([identity.foreignRowId])
            expect(foreign.pageInfo.hasNextPage).toBe(false)

            const maximum = await pageOf(list, identity.workspaceId, { first: 100 })
            expect(maximum.nodes).toHaveLength(4)
            expect(maximum.pageInfo.hasNextPage).toBe(false)
            await expect(pageOf(list, identity.workspaceId, { first: 101 })).rejects.toMatchObject({
                code: "HTTP_SECURITY_REQUEST_INVALID",
            })
            await expect(
                pageOf(list, identity.workspaceId, { first: 2, after: "invalid-cursor" }),
            ).rejects.toMatchObject({
                code: "HTTP_SECURITY_REQUEST_INVALID",
            })
        },
    )
}

const registerCursorScopes = (): void => {
    it("rejects cursors from another list, workspace or thread filter", async () => {
        const identity = await seed()
        const leads = await pageOf("leadBoard", identity.workspaceId, { first: 1 })
        const request = { first: 1, after: leads.pageInfo.endCursor }
        await expect(pageOf("leadBoard", identity.foreignWorkspaceId, request)).rejects.toMatchObject({
            code: "HTTP_SECURITY_REQUEST_INVALID",
        })
        await expect(pageOf("salesOrders", identity.workspaceId, request)).rejects.toMatchObject({
            code: "HTTP_SECURITY_REQUEST_INVALID",
        })
        const threads = world.resolve(WorkThreadsService)
        const filtered = await threads.list(identity.workspaceId, identity.rowIds[0], { first: 1 })
        expect(filtered.nodes.map((node) => node.id)).toEqual([identity.rowIds[3]])
        await expect(
            threads.list(identity.workspaceId, null, { first: 1, after: filtered.pageInfo.endCursor }),
        ).rejects.toMatchObject({ code: "HTTP_SECURITY_REQUEST_INVALID" })
        await expect(threads.list(identity.workspaceId, identity.rowIds[1], { first: 1 })).resolves.toEqual({
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
        })
    })
}

describe("main list cursor connections over PostgreSQL", () => {
    registerPageWalk()
    registerPageBounds()
    registerCursorScopes()
})
