import { Query } from "@nestjs/cqrs"
import type { CrmConnectionView } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadCrmConnectionRequest } from "./load-crm-connection.contracts"

/** Reads a saved CRM connection for the provider page, without the key. */
export class LoadCrmConnectionQuery extends Query<CrmConnectionView> {
    constructor(readonly params: ExecuteParams<LoadCrmConnectionRequest>) {
        super()
    }
}
