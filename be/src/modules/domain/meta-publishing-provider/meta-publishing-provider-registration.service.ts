import { Injectable, type OnModuleInit } from "@nestjs/common"
import { FacebookPublishRegistryService, InstagramPublishRegistryService } from "@modules/domain/provider-registry"
import { MetaFacebookPublishService } from "./meta-facebook-publish.service"
import { MetaInstagramPublishService } from "./meta-instagram-publish.service"

@Injectable()
/** Hands what Meta can publish for core to the registries that ask for it, once, when the app starts: Facebook Pages and Instagram. */
export class MetaPublishingProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly facebookRegistry: FacebookPublishRegistryService,
        private readonly instagramRegistry: InstagramPublishRegistryService,
        private readonly facebook: MetaFacebookPublishService,
        private readonly instagram: MetaInstagramPublishService,
    ) {}

    /** Hands each destination to its registry. */
    onModuleInit(): void {
        this.facebookRegistry.register(this.facebook)
        this.instagramRegistry.register(this.instagram)
    }
}
