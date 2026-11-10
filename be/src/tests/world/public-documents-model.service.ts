import assert from "node:assert/strict"
import type { DynamicModule } from "@nestjs/common"
import { createFakeBridge, FakesHost, openaiCompatibleFake } from "@starci/test-world/fakes"
import type { OpenAiCompatibleClient } from "@starci/test-world/fakes"
import { Secret } from "@modules/platform/config"
import { apiAppModules } from "./api-app.options"
import { worldIds } from "./lite-world.service"

type UsePublicDocumentsModelResultShape = {
    modules: Array<DynamicModule>
    close: () => Promise<void>
    reply(body: string): Promise<void>
}

/** Boots the real API and PostgreSQL graph, faking only the external OpenAI-compatible HTTP endpoint. */
export const usePublicDocumentsModel = (): UsePublicDocumentsModelResultShape => {
    const modules: Array<DynamicModule> = []
    const definition = openaiCompatibleFake({ embeddingDimensions: 1536 })
    const runId = worldIds.next()
    const host = new FakesHost(
        { model: definition },
        { runId, secret: (label) => `public-document-proof-${runId}-${label}`, now: () => new Date() },
    )
    let model: OpenAiCompatibleClient | undefined
    beforeAll(async () => {
        const started = await host.start()
        const endpoint = started.fakes.model
        assert(endpoint, "The managed model fake must be registered")
        const baseUrl = endpoint.values.baseUrl
        const apiKey = endpoint.values.apiKey
        assert(baseUrl && apiKey, "The managed model fake must supply its protocol endpoint")
        model = definition.client(createFakeBridge(started.controlUrl, "model", () => endpoint.url))
        modules.push(
            ...apiAppModules({
                aiTasks: {
                    timeoutMs: 1000,
                    endpoint: {
                        gatewayUrl: baseUrl,
                        virtualKey: new Secret(apiKey),
                        chatModel: "fake-chat",
                        embeddingModel: "fake-embedding",
                    },
                },
            }),
        )
    })
    return {
        modules,
        close: (): Promise<void> => host.close(),
        async reply(body: string): Promise<void> {
            assert(model, "The model boundary must be open")
            await model.reply({ content: JSON.stringify({ body }) })
        },
    }
}
