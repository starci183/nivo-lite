import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReassignShiftsShiftCommand } from "../../application/reassign-shifts-shift.command"
import { ReassignShiftsShiftInput } from "./dto/reassign-shifts-shift.input"
import { ReassignShiftsShiftType } from "./dto/reassign-shifts-shift.type"
import { toReassignShiftsShiftRequest, toReassignShiftsShiftType } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: give a draft shift to another person or open it. */
export class ReassignShiftsShiftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Give a draft shift to another person or open it. Rule breaks come back as warnings. */
    @Mutation(() => ReassignShiftsShiftType, { name: "reassignShiftsShift" })
    async reassignShiftsShift(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ReassignShiftsShiftInput,
    ): Promise<ReassignShiftsShiftType> {
        const result = await this.commandBus.execute(
            new ReassignShiftsShiftCommand({ request: toReassignShiftsShiftRequest(workspaceId, input), principal }),
        )
        return toReassignShiftsShiftType(result)
    }
}
