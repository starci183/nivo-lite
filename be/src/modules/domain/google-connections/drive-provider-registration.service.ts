import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { DriveLiveReachService } from "./drive-live-reach.service"
import { DriveReachRegistryService } from "./drive-reach-registry.service"
import { GOOGLE_DRIVE_SANDBOX_CATALOGUE } from "./google-drive-sandbox.catalogue"
import { GoogleDriveSandboxReachService } from "./google-drive-sandbox-reach.service"

@Injectable()
/** Hands the Google Drive port (live and sandbox) to its registry and its sandbox catalogue to the sandbox page registry, once, when the app starts. */
export class DriveProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly reaches: DriveReachRegistryService,
        private readonly live: DriveLiveReachService,
        private readonly sandbox: GoogleDriveSandboxReachService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both implementations under `google_drive` and the catalogue of the sandbox cases. */
    onModuleInit(): void {
        this.reaches.register({ live: this.live, sandbox: this.sandbox })
        this.catalogues.register(GOOGLE_DRIVE_SANDBOX_CATALOGUE)
    }
}
