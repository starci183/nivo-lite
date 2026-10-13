import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetSyncScheduleCommand } from "../../application/set-sync-schedule.command"
import { SetSyncScheduleInput } from "./dto/set-sync-schedule.input"
import { toSetSyncScheduleRequest } from "./set-sync-schedule.mapper"

@Resolver()
/** GraphQL door of setSyncSchedule. */
export class SetSyncScheduleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sets how often a data connection syncs by itself. */
    @Mutation(() => Boolean, { name: "setSyncSchedule" })
    async setSyncSchedule(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetSyncScheduleInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetSyncScheduleCommand({ request: toSetSyncScheduleRequest(workspaceId, input), principal }),
        )
        return true
    }
}
