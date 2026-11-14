import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { ProviderTriggersError, ProviderTriggersErrorCode } from "./errors/provider-triggers.error"
import type { TriggerDeclaration } from "./trigger-declaration.contracts"

/** The key a declaration is registered under: its source and its name inside that source. */
const keyOf = (provider: string, name: string): string => `${provider}:${name}`

/**
 * THE REGISTRY OF TRIGGER DECLARATIONS (stage 1 of the one event pipeline, lane concept triggers rule 13). Every source registers the
 * declarations it exports when its module starts (providers rule 13: a provider registers itself in a registry at boot); the engine reads
 * them to run a declaration's pure `translate` again on the stored raw row when a run starts, and to check that a delivery names a
 * declaration of its source. Registering the same object twice is a no-op; another object under a taken (source, name) is refused at boot.
 */
export class TriggerDeclarationsRegistry {
    private readonly byKey = new Map<string, TriggerDeclaration>()

    /** Registers the declarations of one source. */
    register(...declarations: ReadonlyArray<TriggerDeclaration>): void {
        for (const declaration of declarations) {
            const key = keyOf(declaration.provider, declaration.name)
            const held = this.byKey.get(key)
            if (held === declaration) continue
            if (held !== undefined) {
                throw new ProviderTriggersError({ code: ProviderTriggersErrorCode.DeclarationTaken, params: { trigger: key } })
            }
            this.byKey.set(key, declaration)
        }
    }

    /** The declaration of a source's trigger, or null when none is registered. */
    of(provider: string, name: string): TriggerDeclaration | null {
        return this.byKey.get(keyOf(provider, name)) ?? null
    }

    /** True when the object is THE registered declaration of its (source, name). */
    isRegistered(declaration: TriggerDeclaration): boolean {
        return this.byKey.get(keyOf(declaration.provider, declaration.name)) === declaration
    }

    /** Every declaration that feeds a verb, in registration order. */
    ofVerb(verb: TriggerVerb): ReadonlyArray<TriggerDeclaration> {
        return [...this.byKey.values()].filter((declaration) => declaration.verb === verb)
    }

    /** Every declaration, in registration order. */
    all(): ReadonlyArray<TriggerDeclaration> {
        return [...this.byKey.values()]
    }
}

/** The one registry of the app (module level, as the wake sources are): a source module registers into it in its `onModuleInit`. */
export const triggerDeclarations: TriggerDeclarationsRegistry = new TriggerDeclarationsRegistry()
