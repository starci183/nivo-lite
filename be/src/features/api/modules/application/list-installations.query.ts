import { Query } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListInstallationsRequest } from "./list-installations.contracts"

/** Asks for every installed agent of the workspace. */
export class ListInstallationsQuery extends Query<ReadonlyArray<InstallationRecord>> {
    constructor(readonly params: ExecuteParams<ListInstallationsRequest>) {
        super()
    }
}
