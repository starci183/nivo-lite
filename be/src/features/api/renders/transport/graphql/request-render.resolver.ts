import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestRenderCommand } from "../../application/request-render.command"
import { toRequestVideoRenderRequest, toRequestVideoRenderType } from "./request-render.mapper"
import { RequestVideoRenderInput } from "./dto/request-render.input"
import { RequestVideoRenderType } from "./dto/request-render.type"

@Resolver()
/** GraphQL door of the existing queued video render use case. */
export class RequestVideoRenderResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a video render after the domain proves the caller manages the project's workspace. */
    @Mutation(() => RequestVideoRenderType, { name: "requestVideoRender" })
    async requestVideoRender(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RequestVideoRenderInput,
    ): Promise<RequestVideoRenderType> {
        const result = await this.commandBus.execute(
            new RequestRenderCommand({ request: toRequestVideoRenderRequest(input), principal }),
        )
        return toRequestVideoRenderType(result)
    }
}
