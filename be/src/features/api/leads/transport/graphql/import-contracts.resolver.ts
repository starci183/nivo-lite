import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { ImportContractsCommand } from "../../application/import-contracts.command"
import { ImportContractsInput } from "./dto/import-contracts.input"
import { ImportContractsType } from "./dto/import-contracts.type"
import { toImportContractsRequest, toImportContractsType } from "./import-contracts.mapper"

@Resolver()
/** GraphQL door of importContracts. */
export class ImportContractsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves every valid row of a contract sheet and answers how many were saved and which rows were skipped. */
    @Mutation(() => ImportContractsType, { name: "importContracts" })
    async importContracts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ImportContractsInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<ImportContractsType> {
        const result = await this.commandBus.execute(
            new ImportContractsCommand({
                request: toImportContractsRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toImportContractsType(result)
    }
}
