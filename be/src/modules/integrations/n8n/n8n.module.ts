import { lookup } from "node:dns/promises"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { N8nClient } from "./n8n.client"
import { N8N_CLIENT, N8N_HOST_RESOLVER, N8N_OPTIONS } from "./n8n.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./n8n.module-definition"
import type { N8nHostResolver } from "./n8n.policy"

const resolveHost: N8nHostResolver = async (host) => (await lookup(host, { all: true })).map((entry) => entry.address)

@Module({})
/** The n8n integration: the signed delivery client over the options parsed at boot and the system resolver. */
export class N8nModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that delivers events. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: N8N_OPTIONS, useValue: options },
                { provide: N8N_HOST_RESOLVER, useValue: resolveHost },
                N8nClient,
                { provide: N8N_CLIENT, useExisting: N8nClient },
            ],
            exports: [N8N_CLIENT],
        }
    }
}
