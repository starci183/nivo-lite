import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewContractImportQuery } from "../../application/preview-contract-import.query"
import { ContractImportPreviewType } from "./dto/contract-import-preview.type"
import { PreviewContractImportInput } from "./dto/preview-contract-import.input"
import { toContractImportPreviewType, toPreviewContractImportRequest } from "./preview-contract-import.mapper"

@Resolver()
/** GraphQL door of previewContractImport. */
export class PreviewContractImportResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a contract sheet and answers its headers, a suggested mapping and the first rows with their problems. */
    @Query(() => ContractImportPreviewType, { name: "previewContractImport" })
    async previewContractImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PreviewContractImportInput,
    ): Promise<ContractImportPreviewType> {
        const result = await this.queryBus.execute(
            new PreviewContractImportQuery({ request: toPreviewContractImportRequest(workspaceId, input), principal }),
        )
        return toContractImportPreviewType(result)
    }
}
