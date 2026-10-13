import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestShiftsLeaveCommand } from "../../application/request-shifts-leave.command"
import { RequestStatusType } from "./dto/request-status.type"
import { RequestShiftsLeaveInput } from "./dto/request-shifts-leave.input"
import { toRequestShiftsLeaveRequest, toRequestStatusType } from "./shifts-requests.mapper"

@Resolver()
/** GraphQL door: ask for leave. */
export class RequestShiftsLeaveResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ask for leave. */
    @Mutation(() => RequestStatusType, { name: "requestShiftsLeave" })
    async requestShiftsLeave(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestShiftsLeaveInput,
    ): Promise<RequestStatusType> {
        const result = await this.commandBus.execute(
            new RequestShiftsLeaveCommand({ request: toRequestShiftsLeaveRequest(workspaceId, input), principal }),
        )
        return toRequestStatusType(result)
    }
}
