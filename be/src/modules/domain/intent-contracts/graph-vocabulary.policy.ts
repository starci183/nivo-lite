import { IntentContractsError, IntentContractsErrorCode } from "./errors/intent-contracts.error"

/** The built-in tool providers of a graph node. A domain adds its own through a plug-in manifest; the core names none of its words. */
const BUILT_IN_PROVIDERS: ReadonlyArray<string> = ["brain", "drive", "sepay", "zalo", "telegram", "office", "mcp"]

/** The built-in steps of each node kind, the vocabulary the work engine walks. */
const BUILT_IN_STEPS: Readonly<Record<string, ReadonlyArray<string>>> = {
    trigger: ["customer_message", "tag", "event", "schedule"],
    condition: ["evaluate"],
    execute: ["read_context", "call"],
    output: ["reply", "approval", "write", "stop"],
}

/** What a plug-in adds to the vocabulary of a graph: tool providers and steps (each under a kind the engine already walks). */
export interface GraphVocabularyManifest {
    /** The tool providers a node may use. */
    readonly providers?: ReadonlyArray<string> | undefined
    /** The steps it adds, by the node kind they belong to. */
    readonly steps?: Readonly<Record<string, ReadonlyArray<string>>> | undefined
}

/**
 * The words a graph document may use for its node kinds, steps and tool providers. The built-ins are data here, and a plug-in manifest
 * registers more, so the closed lists no longer live in the schema of the core.
 */
export class GraphVocabularyPolicy {
    private readonly providers = new Set<string>(BUILT_IN_PROVIDERS)
    private readonly steps = new Map<string, Set<string>>(
        Object.entries(BUILT_IN_STEPS).map(([kind, steps]) => [kind, new Set(steps)]),
    )

    /** Registers the words of a plug-in; a step goes under a kind that exists. */
    add(manifest: GraphVocabularyManifest): void {
        for (const provider of manifest.providers ?? []) this.providers.add(provider)
        for (const [kind, steps] of Object.entries(manifest.steps ?? {})) {
            const known = this.steps.get(kind)
            if (known === undefined)
                throw new IntentContractsError({ code: IntentContractsErrorCode.KeyUnknown, params: { key: kind } })
            for (const step of steps) known.add(step)
        }
    }

    /** True when the provider is registered. */
    hasProvider(provider: string): boolean {
        return this.providers.has(provider)
    }

    /** The registered providers. */
    providerNames(): ReadonlyArray<string> {
        return [...this.providers]
    }

    /** True when the node kind exists. */
    hasKind(kind: string): boolean {
        return this.steps.has(kind)
    }

    /** True when the step is registered under any kind. */
    hasStep(step: string): boolean {
        return [...this.steps.values()].some((steps) => steps.has(step))
    }

    /** The steps registered under a kind. */
    stepsOf(kind: string): ReadonlyArray<string> {
        return [...(this.steps.get(kind) ?? [])]
    }
}

/** The vocabulary of this process: the schema of a graph reads it on every parse, and the plug-ins register into it at start. */
export const graphVocabulary = new GraphVocabularyPolicy()
