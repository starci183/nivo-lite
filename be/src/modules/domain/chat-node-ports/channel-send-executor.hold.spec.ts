import type { RouteHold } from "@modules/domain/customer-routes"
import { CALL, HOLDING, SEND, TURN, WHERE, build } from "@tests/fixtures/builders/channel-send-executor.builder"

type World = Awaited<ReturnType<typeof build>>

/**
 * The staff hold on the memory route store, beside the builder's rows (ruling R43). The builder's `MemoryCustomerRouteStore` gains the
 * same three members in S5c's edit (R4-NOTES, ROAD Opus-1e 05:53); until then this spec lays them on the one store the real
 * `CustomerRoutesService` reads, so the rule is proven on the real executor and the real routes service.
 */
const withHolds = (world: World): Map<string, RouteHold> => {
    const holds = new Map<string, RouteHold>()
    const live = (workspaceId: string, routeId: string): boolean =>
        world.routeRows.rows.some((row) => row.workspaceId === workspaceId && row.id === routeId)
    Object.assign(world.routeRows, {
        holdOf: (workspaceId: string, routeId: string) =>
            Promise.resolve(live(workspaceId, routeId) ? (holds.get(routeId) ?? null) : null),
        hold: (workspaceId: string, routeId: string, memberId: string) => {
            if (!live(workspaceId, routeId)) return Promise.resolve(false)
            if (holds.get(routeId)?.memberId !== memberId) holds.set(routeId, { memberId, at: "2026-11-04T09:00:00.000Z" })
            return Promise.resolve(true)
        },
        release: (_workspaceId: string, routeId: string) => {
            const held = holds.get(routeId) ?? null
            holds.delete(routeId)
            return Promise.resolve(held)
        },
    })
    return holds
}

describe("ChannelSendExecutorService under a staff hold (ruling R43: enforced at the customer-send door only)", () => {
    it("refuses an agent's send to a held route with the one typed reason, asks no provider and keeps the line as not told", async () => {
        const world = await build()
        withHolds(world)
        await expect(world.routes.hold("ws-1", WHERE.routeId, "m-staff")).resolves.toBe("held")

        const answered = await world.executor.execute(TURN, SEND, CALL)

        expect(answered).toMatchObject({ kind: "refused", id: "route_held", facts: { routeId: WHERE.routeId, state: "refused" } })
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(world.ledger.rows).toEqual([expect.objectContaining({ sendKey: CALL.key, state: "refused", reason: "route_held" })])
    })

    it("refuses the engine's own holding line too: nothing but a member's words reaches a held route", async () => {
        const world = await build()
        withHolds(world)
        await world.routes.hold("ws-1", WHERE.routeId, "m-staff")

        const answered = await world.executor.execute(TURN, SEND, HOLDING)

        expect(answered).toMatchObject({ kind: "refused", id: "route_held" })
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
    })

    it("lets a member's typed reply (a turn that names the member) go to the held route", async () => {
        const world = await build()
        withHolds(world)
        await world.routes.hold("ws-1", WHERE.routeId, "m-staff")

        const answered = await world.executor.execute({ ...TURN, memberId: "m-other" }, SEND, CALL)

        expect(answered).toMatchObject({ kind: "message", facts: { delivered: true, routeId: WHERE.routeId } })
        expect(world.delivery.deliverToPerson).toHaveBeenCalledTimes(1)
    })

    it("answers the same refusal from the check the tool door asks before an approval, writing nothing", async () => {
        const world = await build()
        withHolds(world)
        await world.routes.hold("ws-1", WHERE.routeId, "m-staff")

        await expect(world.executor.refusalFor(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "refused", id: "route_held" })
        expect(world.ledger.rows).toEqual([])
    })

    it("sends again once the route is handed back (the hold cleared)", async () => {
        const world = await build()
        withHolds(world)
        await world.routes.hold("ws-1", WHERE.routeId, "m-staff")
        await expect(world.routes.release("ws-1", WHERE.routeId)).resolves.toMatchObject({ memberId: "m-staff" })

        const answered = await world.executor.execute(TURN, SEND, CALL)

        expect(answered).toMatchObject({ kind: "message", facts: { delivered: true } })
    })

    it("holds only the route it names: the person's other entrance is not held", async () => {
        const world = await build()
        const holds = withHolds(world)
        holds.set("route-other", { memberId: "m-staff", at: "2026-11-04T09:00:00.000Z" })

        const answered = await world.executor.execute(TURN, SEND, CALL)

        expect(answered).toMatchObject({ kind: "message", facts: { delivered: true } })
    })
})
