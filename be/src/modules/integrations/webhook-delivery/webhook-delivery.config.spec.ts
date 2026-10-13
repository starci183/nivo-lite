import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseWebhookDeliveryConfig } from "./webhook-delivery.config"

const WEBHOOK_DELIVERY_CONFIG = Symbol("WEBHOOK_DELIVERY_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: WEBHOOK_DELIVERY_CONFIG, useFactory: parseWebhookDeliveryConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(WEBHOOK_DELIVERY_CONFIG)
}

describe("parseWebhookDeliveryConfig", () => {
    it("waits ten seconds unless a deadline is declared", async () => {
        await expect(read({})).resolves.toEqual({ timeoutMs: 10_000 })
        await expect(read({ WEBHOOK_DELIVERY_TIMEOUT: "3s" })).resolves.toEqual({ timeoutMs: 3_000 })
    })
})
