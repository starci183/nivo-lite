import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadCsvImportQuery } from "../../application/load-csv-import.query"
import { CsvSavedImportType } from "./dto/csv-saved-import.type"
import { LoadCsvImportInput } from "./dto/load-csv-import.input"
import { toLoadCsvImportRequest, toLoadCsvImportType } from "./load-csv-import.mapper"

@Resolver()
/** GraphQL door of loadCsvImport. */
export class LoadCsvImportResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the saved setup of one import. */
    @Query(() => CsvSavedImportType, { name: "loadCsvImport" })
    async loadCsvImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadCsvImportInput,
    ): Promise<CsvSavedImportType> {
        const result = await this.queryBus.execute(
            new LoadCsvImportQuery({ request: toLoadCsvImportRequest(workspaceId, input), principal }),
        )
        return toLoadCsvImportType(result)
    }
}
