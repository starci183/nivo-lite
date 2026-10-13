import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RunDocumentImportCommand } from "../../application/run-document-import.command"
import { CsvImportResultType } from "./dto/csv-import-result.type"
import { RunDocumentImportInput } from "./dto/run-document-import.input"
import { toRunDocumentImportRequest, toRunDocumentImportType } from "./run-document-import.mapper"

@Resolver()
/** GraphQL door of runDocumentImport. */
export class RunDocumentImportResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Imports documents: uploaded .docx .pdf .txt .md files and/or one Google Docs link, as document rows. */
    @Mutation(() => CsvImportResultType, { name: "runDocumentImport" })
    async runDocumentImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunDocumentImportInput,
    ): Promise<CsvImportResultType> {
        const result = await this.commandBus.execute(
            new RunDocumentImportCommand({ request: toRunDocumentImportRequest(workspaceId, input), principal }),
        )
        return toRunDocumentImportType(result)
    }
}
