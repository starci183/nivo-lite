import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { GetSetupStateQuery } from "../../application/get-setup-state.query"
import { SetupStateType } from "./dto/setup-state.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { toGetSetupStateRequest, toSetupStateType } from "./modules.mapper"

@Resolver()
/** GraphQL door of the setup chat of an agent. */
export class SetupStateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The open draft (opened on first visit), the revisions, the whole chat and the confirm cards; poll it while `turnPending` is true. */
    @Query(() => SetupStateType, { name: "setupState" })
    async setupState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<SetupStateType> {
        const result = await this.queryBus.execute(
            new GetSetupStateQuery({ request: toGetSetupStateRequest(workspaceId, input, locale), principal }),
        )
        return toSetupStateType(result)
    }
}
