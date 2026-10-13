import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestShiftsSwapCommand } from "../../application/request-shifts-swap.command"
import { RequestStatusType } from "./dto/request-status.type"
import { RequestShiftsSwapInput } from "./dto/request-shifts-swap.input"
import { toRequestShiftsSwapRequest, toRequestStatusType } from "./shifts-requests.mapper"

@Resolver()
/** GraphQL door: hand a shift over or take an open one. */
export class RequestShiftsSwapResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Hand a shift over or take an open one. */
    @Mutation(() => RequestStatusType, { name: "requestShiftsSwap" })
    async requestShiftsSwap(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestShiftsSwapInput,
    ): Promise<RequestStatusType> {
        const result = await this.commandBus.execute(
            new RequestShiftsSwapCommand({ request: toRequestShiftsSwapRequest(workspaceId, input), principal }),
        )
        return toRequestStatusType(result)
    }
}
