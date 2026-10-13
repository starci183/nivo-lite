import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddShiftsDraftShiftCommand } from "../../application/add-shifts-draft-shift.command"
import { AddShiftsDraftShiftInput } from "./dto/add-shifts-draft-shift.input"
import { toAddShiftsDraftShiftRequest } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: add a shift to a draft schedule. */
export class AddShiftsDraftShiftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Add a shift to a draft schedule. */
    @Mutation(() => Boolean, { name: "addShiftsDraftShift" })
    async addShiftsDraftShift(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AddShiftsDraftShiftInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new AddShiftsDraftShiftCommand({ request: toAddShiftsDraftShiftRequest(workspaceId, input), principal }),
        )
        return true
    }
}
