import { Injectable, type OnModuleInit } from "@nestjs/common"
import { FacebookPublishRegistryService, InstagramPublishRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService, type SandboxCatalogue } from "@modules/domain/provider-sandbox"
import { MetaFacebookPublishService } from "./meta-facebook-publish.service"
import { MetaFacebookSandboxPublishService } from "./meta-facebook-sandbox-publish.service"
import { FACEBOOK_SANDBOX_CATALOGUE } from "./meta-facebook-sandbox.catalogue"
import { MetaInstagramPublishService } from "./meta-instagram-publish.service"
import { MetaInstagramSandboxPublishService } from "./meta-instagram-sandbox-publish.service"
import { INSTAGRAM_SANDBOX_CATALOGUE } from "./meta-instagram-sandbox.catalogue"

@Injectable()
/**
 * Hands what Meta can publish for core to the registries that ask for it, once, when the app starts: Facebook Pages and Instagram, each
 * with its live port and its sandbox twin, and the hardcoded sandbox catalogues of both (one provider key, so one merged catalogue).
 */
export class MetaPublishingProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly facebookRegistry: FacebookPublishRegistryService,
        private readonly instagramRegistry: InstagramPublishRegistryService,
        private readonly facebook: MetaFacebookPublishService,
        private readonly instagram: MetaInstagramPublishService,
        private readonly facebookSandbox: MetaFacebookSandboxPublishService,
        private readonly instagramSandbox: MetaInstagramSandboxPublishService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands each destination to its registry, live and sandbox, and registers the catalogues. */
    onModuleInit(): void {
        this.facebookRegistry.register({ live: this.facebook, sandbox: this.facebookSandbox })
        this.instagramRegistry.register({ live: this.instagram, sandbox: this.instagramSandbox })
        this.registerCatalogue(FACEBOOK_SANDBOX_CATALOGUE)
        this.registerCatalogue(INSTAGRAM_SANDBOX_CATALOGUE)
    }

    /** Adds a catalogue's cases to the provider's registered ones (the registry keeps one catalogue per provider key; Meta has two destinations). */
    private registerCatalogue(catalogue: SandboxCatalogue): void {
        const ids = new Set(catalogue.cases.map((one) => one.id))
        const others = this.catalogues.casesOf(catalogue.provider).filter((one) => !ids.has(one.id))
        this.catalogues.register({ provider: catalogue.provider, cases: [...others, ...catalogue.cases] })
    }
}
