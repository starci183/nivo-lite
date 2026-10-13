import { Query } from "@nestjs/cqrs"
import type { SetupVersions } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListSetupVersionsRequest } from "./list-setup-versions.contracts"

/** Asks for the applied context versions of an installation. */
export class ListSetupVersionsQuery extends Query<SetupVersions> {
    constructor(readonly params: ExecuteParams<ListSetupVersionsRequest>) {
        super()
    }
}
