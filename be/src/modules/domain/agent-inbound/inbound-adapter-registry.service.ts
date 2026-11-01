import { Injectable } from "@nestjs/common"
import { wakeSources } from "@modules/domain/agent-work"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { wakeTraitsOf } from "./inbound-adapter.policy"
import { genericWebhookAdapter } from "./generic-webhook.adapter"
import { builtInAdapters } from "./inbound-builtin-adapters.policy"
import type { InboundAdapter } from "./agent-inbound.contracts"
import type { InboundAdapterRegistry, OptionalInboundAdapter } from "./agent-inbound.port"

@Injectable()
/**
 * The adapters that normalize what wakes an agent. Any capability or plug-in adds its own through `add`, a plain port; the four sources that
 * existed before adapters are declared here the same way, with the generic signed webhook. Adding an adapter records its traits with the work core, so a wake of its key can be
 * written, prioritized, retried and restored without the core knowing its name.
 */
export class InboundAdapterRegistryService implements InboundAdapterRegistry {
    private readonly adapters = new Map<string, InboundAdapter>()

    constructor() {
        builtInAdapters().forEach((adapter) => this.add(adapter))
        this.add(genericWebhookAdapter)
    }

    /** Registers an adapter; a second adapter for a key is a wiring bug. */
    add(adapter: InboundAdapter): void {
        if (this.adapters.has(adapter.key)) {
            throw new AgentInboundError({
                code: AgentInboundErrorCode.AdapterDuplicate,
                params: { adapter: adapter.key },
            })
        }
        wakeSources.add(adapter.key, wakeTraitsOf(adapter))
        this.adapters.set(adapter.key, adapter)
    }

    /** The adapter of a key, or undefined. */
    lookup(key: string): OptionalInboundAdapter {
        return this.adapters.get(key)
    }

    /** The adapter of a key; an event of an adapter nobody registered cannot be delivered. */
    of(key: string): InboundAdapter {
        const adapter = this.adapters.get(key)
        if (adapter === undefined) {
            throw new AgentInboundError({ code: AgentInboundErrorCode.AdapterUnknown, params: { adapter: key } })
        }
        return adapter
    }
}
