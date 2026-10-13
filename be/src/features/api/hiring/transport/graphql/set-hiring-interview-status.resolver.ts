import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetHiringInterviewStatusCommand } from "../../application/set-hiring-interview-status.command"
import { SetHiringInterviewStatusInput } from "./dto/set-hiring-interview-status.input"
import { toSetHiringInterviewStatusRequest } from "./hiring-interviews.mapper"

@Resolver()
/** GraphQL door: mark an interview done, cancelled or missed. */
export class SetHiringInterviewStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Mark an interview done, cancelled or missed. */
    @Mutation(() => Boolean, { name: "setHiringInterviewStatus" })
    async setHiringInterviewStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetHiringInterviewStatusInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetHiringInterviewStatusCommand({
                request: toSetHiringInterviewStatusRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
