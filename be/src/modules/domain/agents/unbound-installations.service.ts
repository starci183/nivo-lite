import { Injectable } from "@nestjs/common"
import type {
    InstallationDirectory,
    InstallationRef,
    OptionalContextVersion,
    OptionalInstallation,
} from "./agents.port"

@Injectable()
/** The installations directory of an app whose modules lane has not landed: nothing is installed. */
export class UnboundInstallationsService implements InstallationDirectory {
    /** No installation has an id yet. */
    byId(): Promise<OptionalInstallation> {
        return Promise.resolve(null)
    }

    /** No module has an installation yet. */
    firstOfModule(): Promise<OptionalInstallation> {
        return Promise.resolve(null)
    }

    /** No agent belongs to an installation yet. */
    ofAgent(): Promise<OptionalInstallation> {
        return Promise.resolve(null)
    }

    /** No installation runs on OpenClaw yet. */
    onOpenclaw(): Promise<ReadonlyArray<InstallationRef>> {
        return Promise.resolve([])
    }

    /** No context version exists yet. */
    contextVersionOf(): Promise<OptionalContextVersion> {
        return Promise.resolve(null)
    }
}
