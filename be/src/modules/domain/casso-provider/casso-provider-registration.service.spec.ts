import { mock } from "@starci/jest-preset"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { CassoProviderRegistrationService } from "./casso-provider-registration.service"
import { CASSO_SANDBOX_CATALOGUE } from "./casso-sandbox.catalogue"
import { CassoProviderModule } from "./casso-provider.module"

describe("CassoProviderRegistrationService", () => {
    it("registers the Casso sandbox catalogue at boot, and nothing else (Casso is webhook-only)", () => {
        const catalogues = mock<SandboxCatalogueRegistryService>()

        new CassoProviderRegistrationService(catalogues).onModuleInit()

        expect(catalogues.register).toHaveBeenCalledTimes(1)
        expect(catalogues.register).toHaveBeenCalledWith(CASSO_SANDBOX_CATALOGUE)
    })

    it("the module provides the registration service", () => {
        expect(CassoProviderModule.register({}).providers).toContain(CassoProviderRegistrationService)
    })
})
