import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestVideoScriptCommand } from "../../application/request-video-script.command"
import { toRequestVideoScriptRequest, toRequestVideoScriptType } from "./request-video-script.mapper"
import { RequestVideoScriptInput } from "./dto/request-video-script.input"
import { RequestVideoScriptType } from "./dto/request-video-script.type"

@Resolver()
/** GraphQL door that queues a video script job. */
export class RequestVideoScriptResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues generation and immediately returns a status-query id. */
    @Mutation(() => RequestVideoScriptType, { name: "requestVideoScript" })
    async requestVideoScript(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestVideoScriptInput,
    ): Promise<RequestVideoScriptType> {
        const result = await this.commandBus.execute(
            new RequestVideoScriptCommand({ request: toRequestVideoScriptRequest(input, workspaceId), principal }),
        )
        return toRequestVideoScriptType(result)
    }
}
