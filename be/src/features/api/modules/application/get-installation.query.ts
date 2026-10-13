import { Query } from "@nestjs/cqrs"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetInstallationRequest } from "./get-installation.contracts"

/** Asks for one installed agent of the workspace. */
export class GetInstallationQuery extends Query<InstallationRecord> {
    constructor(readonly params: ExecuteParams<GetInstallationRequest>) {
        super()
    }
}
