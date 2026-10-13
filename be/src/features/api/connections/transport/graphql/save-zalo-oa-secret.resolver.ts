import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveZaloOaSecretCommand } from "../../application/save-zalo-oa-secret.command"
import { SaveZaloOaSecretInput } from "./dto/save-zalo-oa-secret.input"
import { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"
import { toSaveZaloOaSecretRequest, toSaveZaloOaSecretType } from "./save-zalo-oa-secret.mapper"

@Resolver()
/** GraphQL door of saveZaloOaSecret. */
export class SaveZaloOaSecretResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Seals the OA Secret Key of a Zalo connection. */
    @Mutation(() => ZaloWizardConnectionType, { name: "saveZaloOaSecret" })
    async saveZaloOaSecret(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveZaloOaSecretInput,
    ): Promise<ZaloWizardConnectionType> {
        const result = await this.commandBus.execute(
            new SaveZaloOaSecretCommand({ request: toSaveZaloOaSecretRequest(workspaceId, input), principal }),
        )
        return toSaveZaloOaSecretType(result)
    }
}
