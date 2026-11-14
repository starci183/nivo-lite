import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { StopHandBackService } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { HeldLinesService } from "@modules/domain/conversations"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import {
    WorkspaceMembersError,
    WorkspaceMembersErrorCode,
} from "@modules/domain/workspace-members/errors/workspace-members.error"
import { DoorPressesService } from "./door-presses.service"

/** The door a release press is recorded under. */
const RELEASE = "conversation.release"

/**
 * What handing a conversation back did: `released` (the staff hold of the route was cleared, or a take-over of a stop on it was ended, or
 * both; the ONE resume event was then delivered), `nothing_held` (nobody held the route and no take-over stood: NO event is delivered, so a
 * second press never makes the agent answer twice), `not_found` (no such route in the workspace). `answered`: how many agents the resume
 * event woke; 0 when none (or none was delivered).
 */
export interface ConversationRelease {
    /** How it ended. */
    readonly outcome: "released" | "nothing_held" | "not_found"
    /** The agents woken by the resume event; 0 when none. */
    readonly answered: number
}

@Injectable()
/**
 * "Hand back to the agent": an owner or a manager hands a route back after a person of the shop took the thread over. FIRST the staff
 * hold of the route is cleared (ruling R43: the hold is engine data on the route, so the agents may send again), THEN ONE resume event
 * for that route is delivered through the one delivery function to the graphs registered on the route's channel trigger
 * (`HeldLinesService.answerHeld`), so the front desk answers the lines that arrived meanwhile (it reads them from the engine's own
 * customer lines). A press that released a hold or woke someone is recorded with who and when. An app with no customer intake wakes
 * nobody. Generic: it names a route, nothing of any chat. Two callers: the GraphQL door (`hand`, an owner or a manager by account) and
 * the `platform.route-holds` port of a module's workbench action (`handAs`, the seat the door already proved for that action).
 */
export class HoldReleaseDoorService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly presses: DoorPressesService,
        private readonly seats: MemberLookupService,
        @Optional() private readonly routes?: CustomerRoutesService,
        @Optional() private readonly heldLines?: HeldLinesService,
        @Optional() private readonly takeOvers?: StopHandBackService,
    ) {}

    /** Hands the route back to the agents, for an owner or a manager. */
    async hand(userId: string, workspaceId: string, routeId: string): Promise<ConversationRelease> {
        const memberId = await this.access.manager(userId, workspaceId)
        const member = await this.members.require(userId, workspaceId)
        return this.handBack(workspaceId, routeId, { memberId, name: member.displayName })
    }

    /**
     * Hands the route back as one seat of the workspace: the member a workbench action runs as (its permission was proven by the door). A
     * member with no active seat is refused with a typed error, never a silent hand-back.
     */
    async handAs(workspaceId: string, memberId: string, routeId: string): Promise<ConversationRelease> {
        const seat = await this.seats.activeSeatById(workspaceId, memberId)
        if (seat === null)
            throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.MemberNotFound, params: { memberId } })
        return this.handBack(workspaceId, routeId, { memberId, name: seat.displayName })
    }

    /**
     * The hand-back itself, in ONE transaction (owner ruling R51 item 3): the staff hold of the route is cleared, every stop a person took
     * over on the route is ended as this member (`StopHandBackService`: its ending decision is admitted through the resume door, so the
     * stop resolves, the run that waited at its gate ends and the freeze that stop caused releases once the drain applies it), and the ONE
     * resume event is delivered. The hold goes before the resume event: the run the event wakes must be free to answer the customer.
     */
    private async handBack(
        workspaceId: string,
        routeId: string,
        by: { readonly memberId: string; readonly name: string },
    ): Promise<ConversationRelease> {
        const route = this.routes === undefined ? null : await this.routes.get(workspaceId, routeId)
        if (this.routes !== undefined && route === null) return { outcome: "not_found", answered: 0 }
        const { held, ended, answered } = await this.entityManager.transaction(async (tx) => {
            const cleared = (await this.routes?.release(workspaceId, routeId, tx)) ?? null
            const stops = (await this.takeOvers?.handedBack(tx, workspaceId, routeId, route?.contactId ?? null, by.memberId)) ?? 0
            // ONE resume event per hand-back (MX-CORE DEF-4, R35/R51): only a press that ended something (a staff hold cleared, or a
            // take-over closed) delivers it. A press with nothing held (a second press, a press after the drain, a double click before
            // it) delivers nothing: the agent would otherwise answer again with no new line of the person.
            if (cleared === null && stops === 0) return { held: null, ended: 0, answered: 0 }
            const woken = (await this.heldLines?.answerHeld(workspaceId, routeId, tx)) ?? 0
            return { held: cleared, ended: stops, answered: woken }
        })
        if (held === null && ended === 0) return { outcome: "nothing_held", answered: 0 }
        await this.presses.record({
            workspaceId,
            door: RELEASE,
            subject: routeId,
            memberId: by.memberId,
            memberName: by.name,
            outcome: "released",
            detail: { answered, heldBy: held?.memberId ?? null, takeOversEnded: ended },
        })
        return { outcome: "released", answered }
    }
}
