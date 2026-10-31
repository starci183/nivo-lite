import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RotateSepayKeyCommand } from "../../application/rotate-sepay-key.command"
import { RotateSepayKeyInput } from "./dto/rotate-sepay-key.input"
import { SepayKeyType } from "./dto/sepay-key.type"
import { toRotateSepayKeyRequest, toRotateSepayKeyType } from "./rotate-sepay-key.mapper"

@Resolver()
/** GraphQL door of rotateSepayKey. */
export class RotateSepayKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Issues a new SePay API key. */
    @Mutation(() => SepayKeyType, { name: "rotateSepayKey" })
    async rotateSepayKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RotateSepayKeyInput,
    ): Promise<SepayKeyType> {
        const result = await this.commandBus.execute(
            new RotateSepayKeyCommand({ request: toRotateSepayKeyRequest(workspaceId, input), principal }),
        )
        return toRotateSepayKeyType(result)
    }
}
