import { Injectable } from "@nestjs/common"
import type { SandboxCase, SandboxCatalogue, SandboxPrefill } from "./provider-sandbox.contracts"

@Injectable()
/**
 * The hardcoded catalogues of the providers' sandboxes (ruling R60), registered at boot beside each sandbox implementation: what the
 * Sandbox page lists (each provider's named cases `<PROVIDER>-<n>`, the inbound ones with the webhook body they send).
 */
export class SandboxCatalogueRegistryService {
    private readonly catalogues = new Map<string, ReadonlyArray<SandboxCase>>()
    private readonly prefills = new Map<string, SandboxPrefill>()

    /**
     * Adds a catalogue's cases under its provider key, MERGED with what other capabilities of the same account provider registered
     * (YouTube and Google Calendar share `google`, Facebook and Instagram `meta`); a case id registered again replaces its earlier case.
     */
    register(catalogue: SandboxCatalogue): void {
        const ids = new Set(catalogue.cases.map((one) => one.id))
        const kept = (this.catalogues.get(catalogue.provider) ?? []).filter((one) => !ids.has(one.id))
        this.catalogues.set(catalogue.provider, [...kept, ...catalogue.cases])
        if (catalogue.prefill !== undefined) this.prefills.set(catalogue.provider, catalogue.prefill)
    }

    /** Where a provider's inbound inputs are prefilled from (R62), or null when it takes no request of the agent's. */
    prefillOf(provider: string): SandboxPrefill | null {
        return this.prefills.get(provider) ?? null
    }

    /** The cases of a provider, in their order; empty when it registered none. */
    casesOf(provider: string): ReadonlyArray<SandboxCase> {
        return this.catalogues.get(provider) ?? []
    }

    /** One case of a provider, or null. */
    caseOf(provider: string, caseId: string): SandboxCase | null {
        return this.casesOf(provider).find((one) => one.id === caseId) ?? null
    }

    /** The providers that registered a catalogue, in registration order. */
    providers(): ReadonlyArray<string> {
        return [...this.catalogues.keys()]
    }
}
