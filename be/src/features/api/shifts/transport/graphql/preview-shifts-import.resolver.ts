import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewShiftsImportQuery } from "../../application/preview-shifts-import.query"
import { PreviewShiftsImportInput } from "./dto/preview-shifts-import.input"
import { PreviewShiftsImportType } from "./dto/preview-shifts-import.type"
import { toPreviewShiftsImportRequest, toPreviewShiftsImportType } from "./preview-shifts-import.mapper"

@Resolver()
/** GraphQL door: read the quick import text and report what it would add. */
export class PreviewShiftsImportResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Read the quick import text and report what it would add. Writes nothing. */
    @Query(() => PreviewShiftsImportType, { name: "previewShiftsImport" })
    async previewShiftsImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PreviewShiftsImportInput,
    ): Promise<PreviewShiftsImportType> {
        const result = await this.queryBus.execute(
            new PreviewShiftsImportQuery({ request: toPreviewShiftsImportRequest(workspaceId, input), principal }),
        )
        return toPreviewShiftsImportType(result)
    }
}
