import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestShiftsPublishCommand } from "../../application/request-shifts-publish.command"
import { RequestStatusType } from "./dto/request-status.type"
import { ShiftsScheduleRefInput } from "./dto/shifts-schedule-ref.input"
import { toRequestShiftsPublishRequest, toRequestStatusType } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: put a draft schedule before the owner to publish. */
export class RequestShiftsPublishResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Put a draft schedule before the owner to publish. */
    @Mutation(() => RequestStatusType, { name: "requestShiftsPublish" })
    async requestShiftsPublish(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsScheduleRefInput,
    ): Promise<RequestStatusType> {
        const result = await this.commandBus.execute(
            new RequestShiftsPublishCommand({ request: toRequestShiftsPublishRequest(workspaceId, input), principal }),
        )
        return toRequestStatusType(result)
    }
}
