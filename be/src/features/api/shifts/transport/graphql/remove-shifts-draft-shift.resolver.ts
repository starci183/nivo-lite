import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveShiftsDraftShiftCommand } from "../../application/remove-shifts-draft-shift.command"
import { ShiftsShiftRefInput } from "./dto/shifts-shift-ref.input"
import { toRemoveShiftsDraftShiftRequest } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: remove a shift from a draft schedule. */
export class RemoveShiftsDraftShiftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Remove a shift from a draft schedule. */
    @Mutation(() => Boolean, { name: "removeShiftsDraftShift" })
    async removeShiftsDraftShift(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsShiftRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RemoveShiftsDraftShiftCommand({
                request: toRemoveShiftsDraftShiftRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
