import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DomainRegistrarRegistryService } from "@modules/domain/provider-registry"
import { InetDomainRegistrarService } from "./inet-domain-registrar.service"

@Injectable()
/** Hands iNET's domain purposes to the registry that asks for them, once, when the app starts. */
export class InetProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registrars: DomainRegistrarRegistryService,
        private readonly registrar: InetDomainRegistrarService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.registrars.register(this.registrar)
    }
}
