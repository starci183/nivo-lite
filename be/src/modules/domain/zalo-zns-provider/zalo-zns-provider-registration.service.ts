import { Injectable, type OnModuleInit } from "@nestjs/common"
import { TemplateMessageRegistryService } from "@modules/domain/provider-registry"
import { ZaloZnsTemplateService } from "./zalo-zns-template.service"

@Injectable()
/** Hands ZNS to the registry of template-message providers, once, when the app starts. */
export class ZaloZnsProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly templates: TemplateMessageRegistryService,
        private readonly zns: ZaloZnsTemplateService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.templates.register(this.zns)
    }
}
