import { Query } from "@nestjs/cqrs"
import type { ProviderRightHolders } from "@modules/domain/node-right-rollups"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetProviderRightHoldersRequest } from "./get-provider-right-holders.contracts"

/** The rights tab of one connected account: every right of its provider with who holds it. */
export class GetProviderRightHoldersQuery extends Query<ProviderRightHolders> {
    constructor(readonly params: ExecuteParams<GetProviderRightHoldersRequest>) {
        super()
    }
}
