import type {
    GraphVocabularyManifest,
    IntentCheck,
    IntentFrame,
    IntentResultSchema,
} from "@modules/domain/intent-contracts"

/**
 * Everything a domain brings to the agent core, in one declaration, the way a provider brings a manifest to the gateway. Adding a domain
 * is adding a manifest: no core file names it, switches over it or lists it in an enum.
 */
export interface AgentPluginManifest {
    /** The key of the plug-in, unique across the app. */
    readonly key: string
    /** The frames of the intents it owns. */
    readonly contracts?: ReadonlyArray<IntentFrame> | undefined
    /** The schema of each kind of result it defines, by key. */
    readonly results?: Readonly<Record<string, IntentResultSchema>> | undefined
    /** The function of each check it defines, by key. */
    readonly checks?: Readonly<Record<string, IntentCheck>> | undefined
    /** The tool providers and steps it adds to the words a graph may use. */
    readonly vocabulary?: GraphVocabularyManifest | undefined
}
