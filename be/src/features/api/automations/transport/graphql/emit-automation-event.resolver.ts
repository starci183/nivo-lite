import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { EmitEventCommand } from "../../application/emit-event.command"
import { EmitAutomationEventInput } from "./dto/emit-automation-event.input"
import { toEmitEventRequest } from "./emit-automation-event.mapper"

@Resolver()
/** GraphQL door of the business events a member reports. */
export class EmitAutomationEventResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Tells the engine a business event happened; answers true once it is taken. */
    @Mutation(() => Boolean, { name: "emitAutomationEvent" })
    async emitAutomationEvent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: EmitAutomationEventInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new EmitEventCommand({ request: toEmitEventRequest(workspaceId, input), principal }),
        )
        return true
    }
}
