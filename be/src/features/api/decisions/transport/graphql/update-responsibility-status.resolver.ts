import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateResponsibilityStatusCommand } from "../../application/update-responsibility-status.command"
import { ResponsibilityType } from "./dto/responsibility.type"
import { UpdateResponsibilityStatusInput } from "./dto/update-responsibility-status.input"
import { toResponsibilityType, toUpdateResponsibilityStatusRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door that moves a responsibility to a status. */
export class UpdateResponsibilityStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Moves a responsibility to a status. */
    @Mutation(() => ResponsibilityType, { name: "updateResponsibilityStatus" })
    async updateResponsibilityStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateResponsibilityStatusInput,
    ): Promise<ResponsibilityType> {
        const result = await this.commandBus.execute(
            new UpdateResponsibilityStatusCommand({
                request: toUpdateResponsibilityStatusRequest(workspaceId, input),
                principal,
            }),
        )
        return toResponsibilityType(result)
    }
}
