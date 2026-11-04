import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import type { Principal } from "@modules/platform/cqrs"
import { ImportAgentTemplateCommand } from "../../application/import-agent-template.command"
import { InstalledTemplateType } from "./dto/installed-template.type"
import { ImportAgentTemplateInput } from "./dto/import-agent-template.input"
import { toImportAgentTemplateRequest, toImportAgentTemplateType } from "./import-agent-template.mapper"

@Resolver()
/** GraphQL door of importAgentTemplate. */
export class ImportAgentTemplateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Installs a template of the caller's own account as a new agent in this workspace, in shadow mode. */
    @Mutation(() => InstalledTemplateType, { name: "importAgentTemplate" })
    async importAgentTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ImportAgentTemplateInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<InstalledTemplateType> {
        const result = await this.commandBus.execute(
            new ImportAgentTemplateCommand({
                request: toImportAgentTemplateRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toImportAgentTemplateType(result)
    }
}
