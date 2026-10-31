import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ImportBrainDossiersCommand } from "../../application/import-brain-dossiers.command"
import { BrainDossierImportType } from "./dto/brain-dossier-import.type"
import { ImportBrainDossiersInput } from "./dto/import-brain-dossiers.input"
import { toBrainDossierImportType, toImportBrainDossiersRequest } from "./import-brain-dossiers.mapper"

@Resolver()
/** GraphQL door of replacing the dossiers of the workspace with those of a checklist workbook. */
export class ImportBrainDossiersResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reads the status tab of an uploaded checklist workbook and makes its dossiers those of the workspace; owners and managers only. */
    @Mutation(() => BrainDossierImportType, { name: "importBrainDossiers" })
    async importBrainDossiers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ImportBrainDossiersInput,
    ): Promise<BrainDossierImportType> {
        const result = await this.commandBus.execute(
            new ImportBrainDossiersCommand({ request: toImportBrainDossiersRequest(workspaceId, input), principal }),
        )
        return toBrainDossierImportType(result)
    }
}
