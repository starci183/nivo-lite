import { Query } from "@nestjs/cqrs"
import type { MetaWizardConnection } from "@modules/domain/meta-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetMetaConnectionRequest } from "./get-meta-connection.contracts"

/** Asks for the wizard view of a Meta connection. */
export class GetMetaConnectionQuery extends Query<MetaWizardConnection> {
    constructor(readonly params: ExecuteParams<GetMetaConnectionRequest>) {
        super()
    }
}
