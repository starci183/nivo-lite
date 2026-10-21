import { Query } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListInstallationsRequest } from "./list-installations.contracts"

/** Asks for every installed agent of the workspace. */
export class ListInstallationsQuery extends Query<ReadonlyArray<InstallationView>> {
    constructor(readonly params: ExecuteParams<ListInstallationsRequest>) {
        super()
    }
}
