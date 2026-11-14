import { Injectable, Optional } from "@nestjs/common"
import type { RouteHolds } from "@nivo-lite/agent-sdk/platform"
import { HoldReleaseDoorService } from "@modules/domain/agent-doors"
import { CustomerRoutesService } from "@modules/domain/customer-routes"

/** Who a `platform.route-holds` port acts as: the workspace of the door run and the seat it runs as. */
export interface RouteHoldsAsker {
    /** The workspace of the door run. */
    readonly workspaceId: string
    /** The seat the action runs as. */
    readonly memberId: string
}

@Injectable()
/**
 * The `platform.route-holds` port (ruling R43: the staff hold of a route is engine data): a module's workbench action takes a customer's
 * route over for a person (`take` = `CustomerRoutesService.hold` as the action's seat), reads who holds it (`holderOf`, the inbox's "who
 * holds"), lists the routes members hold now in the workspace (`held`, the inbox count and the desk figure, R45), and hands it back to the agents (`handBack` = the same act as the GraphQL hand-back: the hold is cleared, THEN one resume event
 * through the one delivery function). Scoped to the workspace of the door run; generic: it names a route, nothing of any chat. While a
 * route is held, the customer-send door refuses every AI send to it (`route_held`).
 */
export class RouteHoldsPortService {
    constructor(
        private readonly routes: CustomerRoutesService,
        @Optional() private readonly release?: HoldReleaseDoorService,
    ) {}

    /** The port for one seat of one workspace, or null when this app has no hand-back door (the door then leaves it unprovided). */
    portFor(asker: RouteHoldsAsker): RouteHolds | null {
        const release = this.release
        if (release === undefined) return null
        return {
            take: (routeId) => this.routes.hold(asker.workspaceId, routeId, asker.memberId),
            holderOf: async (routeId) => {
                const held = await this.routes.holdOf(asker.workspaceId, routeId)
                return held === null ? null : { memberId: held.memberId, at: held.at }
            },
            handBack: (routeId) => release.handAs(asker.workspaceId, asker.memberId, routeId),
            held: async (limit) => {
                const page = await this.routes.held(asker.workspaceId, limit)
                return {
                    count: page.count,
                    routes: page.routes.map((route) => ({ routeId: route.routeId, memberId: route.memberId, at: route.at })),
                }
            },
        }
    }
}
