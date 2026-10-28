import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveZnsRenewalCommand } from "../../application/save-zns-renewal.command"
import { SaveZnsRenewalInput } from "./dto/save-zns-renewal.input"
import { ZnsRenewalType } from "./dto/zns-renewal.type"
import { toSaveZnsRenewalRequest, toSaveZnsRenewalType } from "./save-zns-renewal.mapper"

@Resolver()
/** GraphQL door of saveZnsRenewal. */
export class SaveZnsRenewalResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stores the ZNS renewal template of a Zalo connection; null when the fallback is turned off. */
    @Mutation(() => ZnsRenewalType, { name: "saveZnsRenewal", nullable: true })
    async saveZnsRenewal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveZnsRenewalInput,
    ): Promise<ZnsRenewalType | null> {
        const result = await this.commandBus.execute(
            new SaveZnsRenewalCommand({ request: toSaveZnsRenewalRequest(workspaceId, input), principal }),
        )
        return toSaveZnsRenewalType(result)
    }
}
