import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevealSepayKeyCommand } from "../../application/reveal-sepay-key.command"
import { RevealSepayKeyInput } from "./dto/reveal-sepay-key.input"
import { SepayKeyType } from "./dto/sepay-key.type"
import { toRevealSepayKeyRequest, toRevealSepayKeyType } from "./reveal-sepay-key.mapper"

@Resolver()
/** GraphQL door of revealSepayKey. */
export class RevealSepayKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Shows the SePay API key again. */
    @Mutation(() => SepayKeyType, { name: "revealSepayKey" })
    async revealSepayKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RevealSepayKeyInput,
    ): Promise<SepayKeyType> {
        const result = await this.commandBus.execute(
            new RevealSepayKeyCommand({ request: toRevealSepayKeyRequest(workspaceId, input), principal }),
        )
        return toRevealSepayKeyType(result)
    }
}
