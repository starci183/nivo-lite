import { Query } from "@nestjs/cqrs"
import type { InstallationView } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetInstallationRequest } from "./get-installation.contracts"

/** Asks for one installed agent of the workspace. */
export class GetInstallationQuery extends Query<InstallationView> {
    constructor(readonly params: ExecuteParams<GetInstallationRequest>) {
        super()
    }
}
