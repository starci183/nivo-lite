import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ApplySetupCommand } from "../../application/apply-setup.command"
import { SetupApplyResultType } from "./dto/setup-apply-result.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { toApplySetupRequest, toSetupApplyResultType } from "./modules.mapper"

@Resolver()
/** GraphQL door that applies a setup. */
export class ApplySetupResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies the open draft: a new immutable context version becomes the one in use and the agent runs on it right away. */
    @Mutation(() => SetupApplyResultType, { name: "applySetup" })
    async applySetup(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<SetupApplyResultType> {
        const result = await this.commandBus.execute(
            new ApplySetupCommand({ request: toApplySetupRequest(workspaceId, input, locale), principal }),
        )
        return toSetupApplyResultType(result)
    }
}
