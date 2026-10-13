import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewCsvSourceQuery } from "../../application/preview-csv-source.query"
import { CsvPreviewType } from "./dto/csv-preview.type"
import { PreviewCsvSourceInput } from "./dto/preview-csv-source.input"
import { toPreviewCsvSourceRequest, toPreviewCsvSourceType } from "./preview-csv-source.mapper"

@Resolver()
/** GraphQL door of previewCsvSource. */
export class PreviewCsvSourceResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads an import source and answers its headers, first rows and a suggested mapping. */
    @Query(() => CsvPreviewType, { name: "previewCsvSource" })
    async previewCsvSource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PreviewCsvSourceInput,
    ): Promise<CsvPreviewType> {
        const result = await this.queryBus.execute(
            new PreviewCsvSourceQuery({ request: toPreviewCsvSourceRequest(workspaceId, input), principal }),
        )
        return toPreviewCsvSourceType(result)
    }
}
