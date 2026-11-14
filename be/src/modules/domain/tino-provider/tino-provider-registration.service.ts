import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DomainRegistrarRegistryService } from "@modules/domain/provider-registry"
import { TinoDomainRegistrarService } from "./tino-domain-registrar.service"

@Injectable()
/** Hands Tino's domain purposes to the registry that asks for them, once, when the app starts. */
export class TinoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registrars: DomainRegistrarRegistryService,
        private readonly registrar: TinoDomainRegistrarService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.registrars.register(this.registrar)
    }
}
