import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RunCsvImportCommand } from "../../application/run-csv-import.command"
import { CsvImportResultType } from "./dto/csv-import-result.type"
import { RunCsvImportInput } from "./dto/run-csv-import.input"
import { toRunCsvImportRequest, toRunCsvImportType } from "./run-csv-import.mapper"

@Resolver()
/** GraphQL door of runCsvImport. */
export class RunCsvImportResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Imports a table source (file, Google Sheets link, pasted or typed rows) with the chosen mapping. */
    @Mutation(() => CsvImportResultType, { name: "runCsvImport" })
    async runCsvImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RunCsvImportInput,
    ): Promise<CsvImportResultType> {
        const result = await this.commandBus.execute(
            new RunCsvImportCommand({ request: toRunCsvImportRequest(workspaceId, input), principal }),
        )
        return toRunCsvImportType(result)
    }
}
