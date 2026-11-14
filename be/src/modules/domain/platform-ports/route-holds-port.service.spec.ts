import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HoldReleaseDoorService } from "@modules/domain/agent-doors"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { RouteHoldsPortService } from "./route-holds-port.service"

const ASKER = { workspaceId: "ws-1", memberId: "m-staff" }

const build = async (withDoor = true) => {
    const routes = mock<CustomerRoutesService>()
    const release = mock<HoldReleaseDoorService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RouteHoldsPortService,
            { provide: CustomerRoutesService, useValue: routes },
            ...(withDoor ? [{ provide: HoldReleaseDoorService, useValue: release }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(RouteHoldsPortService), routes, release }
}

/** The port for the asker; a missing port fails the case loudly. */
const portOf = (service: RouteHoldsPortService) => {
    const port = service.portFor(ASKER)
    if (port === null) throw new TypeError("route holds port absent")
    return port
}

describe("RouteHoldsPortService: the `platform.route-holds` port (ruling R43, the staff hold is engine data)", () => {
    it("takes a route over as the action's seat, in the run's workspace; an unknown route is not_found", async () => {
        const { service, routes } = await build()
        routes.hold.mockResolvedValueOnce("held").mockResolvedValueOnce("not_found")
        const port = portOf(service)

        await expect(port.take("route-1")).resolves.toBe("held")
        await expect(port.take("route-x")).resolves.toBe("not_found")
        expect(routes.hold).toHaveBeenCalledWith("ws-1", "route-1", "m-staff")
    })

    it("reads who holds a route (the inbox's 'who holds'), null when the agents speak on it", async () => {
        const { service, routes } = await build()
        routes.holdOf.mockResolvedValueOnce({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" }).mockResolvedValueOnce(null)
        const port = portOf(service)

        await expect(port.holderOf("route-1")).resolves.toEqual({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })
        await expect(port.holderOf("route-2")).resolves.toBeNull()
        expect(routes.holdOf).toHaveBeenCalledWith("ws-1", "route-1")
    })

    it("hands a route back through the one hand-back door as the action's seat (clear the hold, then one resume event)", async () => {
        const { service, release } = await build()
        release.handAs.mockResolvedValue({ outcome: "released", answered: 1 })

        await expect(portOf(service).handBack("route-1")).resolves.toEqual({ outcome: "released", answered: 1 })
        expect(release.handAs).toHaveBeenCalledWith("ws-1", "m-staff", "route-1")
    })

    it("lists the routes held now in the run's workspace (R45: inbox count, desk figure), the limit passed to the engine as asked", async () => {
        const { service, routes } = await build()
        routes.held.mockResolvedValue({
            count: 3,
            routes: [{ routeId: "route-2", memberId: "m-staff", at: "2026-11-14T09:00:00.000Z" }],
        })

        await expect(portOf(service).held(1)).resolves.toEqual({
            count: 3,
            routes: [{ routeId: "route-2", memberId: "m-staff", at: "2026-11-14T09:00:00.000Z" }],
        })
        expect(routes.held).toHaveBeenCalledWith("ws-1", 1)
    })

    it("gives no port in an app with no hand-back door (the door then reports it unprovided)", async () => {
        const { service } = await build(false)
        expect(service.portFor(ASKER)).toBeNull()
    })
})
