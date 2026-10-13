import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { N8nHostClient } from "./n8n-host.client"
import { N8N_HOST, N8N_HOST_OPTIONS, N8N_HOST_SHELL } from "./n8n-host.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./n8n-host.module-definition"
import { N8nHostService } from "./n8n-host.service"

@Module({})
/** The n8n host integration: the sync of the shared workflows into the container, over ssh or a local shell. */
export class N8nHostModule extends ConfigurableModuleClass {
    /** Registers the sync once per app that runs it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: N8N_HOST_OPTIONS, useValue: options },
                N8nHostClient,
                { provide: N8N_HOST_SHELL, useExisting: N8nHostClient },
                N8nHostService,
                { provide: N8N_HOST, useExisting: N8nHostService },
            ],
            exports: [N8N_HOST],
        }
    }
}
