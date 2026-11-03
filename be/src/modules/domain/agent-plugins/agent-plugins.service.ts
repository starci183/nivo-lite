import { Injectable } from "@nestjs/common"
import { graphVocabulary, IntentRegistryService } from "@modules/domain/intent-contracts"
import { AgentPluginsError, AgentPluginsErrorCode } from "./errors/agent-plugins.error"
import type { AgentPluginManifest } from "./agent-plugins.contracts"

@Injectable()
/**
 * The plug-ins of the agent core. A domain calls `add` once with its manifest in `onModuleInit`; the manifest fans out to the registry of
 * intents (frames, results and checks). A second manifest under one key throws, and so does a frame that
 * names a result or a check nobody registered, so a wiring bug stops the start and never a turn.
 */
export class AgentPluginsService {
    private readonly registered = new Set<string>()

    constructor(private readonly intents: IntentRegistryService) {}

    /** The keys of the plug-ins registered so far. */
    keys(): ReadonlyArray<string> {
        return [...this.registered]
    }

    /** Registers a plug-in. */
    add(manifest: AgentPluginManifest): void {
        if (this.registered.has(manifest.key)) {
            throw new AgentPluginsError({ code: AgentPluginsErrorCode.KeyDuplicate, params: { key: manifest.key } })
        }
        this.intents.add({
            frames: manifest.contracts ?? [],
            results: manifest.results ?? {},
            checks: manifest.checks ?? {},
        })
        graphVocabulary.add(manifest.vocabulary ?? {})
        this.registered.add(manifest.key)
    }
}
