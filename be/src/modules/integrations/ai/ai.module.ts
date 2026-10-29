import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AiClient } from "./ai.client"
import { AiService } from "./ai.service"
import { AI, AI_ENDPOINT_OPTIONS, AI_RUNNER } from "./ai.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai.module-definition"
import type { AiEndpoint } from "./ai.options"

/** The endpoint to call, or null when no virtual key or gateway URL is set so the app boots without AI. */
const endpointOf = (options: typeof OPTIONS_TYPE): AiEndpoint | null =>
    options.virtualKey === null || options.gatewayUrl === null
        ? null
        : { ...options, virtualKey: options.virtualKey, gatewayUrl: options.gatewayUrl }

@Module({})
/**
 * The LangChain integration (BE-AI-3): `@langchain/openai` pointed at the AI router gateway with the virtual key, and the service the
 * app calls it through. Without a virtual key or a gateway URL it registers no client and the service answers unavailable.
 */
export class AiModule extends ConfigurableModuleClass {
    /** Registers the service once per app that calls a model. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const endpoint = endpointOf(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...(endpoint === null
                    ? [{ provide: AI_RUNNER, useValue: null }]
                    : [
                          { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint },
                          AiClient,
                          { provide: AI_RUNNER, useExisting: AiClient },
                      ]),
                AiService,
                { provide: AI, useExisting: AiService },
            ],
            exports: [AiService, AI],
        }
    }
}
