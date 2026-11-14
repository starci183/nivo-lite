import { Injectable, type OnModuleInit } from "@nestjs/common"
import { OpenApiReachRegistryService, OpenApiSandboxReachService } from "@modules/domain/openapi-provider"
import { OpenApiLiveReachService } from "./openapi-live-reach.service"

@Injectable()
/**
 * Registers how API accounts are reached, once, when the app starts: the live reach (the account's real host, this app's OpenAPI client
 * and key store) and its sandbox twin (the package's fixtures, never a host). The connector resolves each account's reach by `portFor`.
 */
export class OpenApiReachRegistrationService implements OnModuleInit {
    constructor(
        private readonly reaches: OpenApiReachRegistryService,
        private readonly liveReach: OpenApiLiveReachService,
        private readonly sandboxReach: OpenApiSandboxReachService,
    ) {}

    /** Registers both reaches under `openapi`. */
    onModuleInit(): void {
        this.reaches.register({ live: this.liveReach, sandbox: this.sandboxReach })
    }
}
