import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseDeepseekConfig } from "./deepseek.config"

const DEEPSEEK_CONFIG = Symbol("DEEPSEEK_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: DEEPSEEK_CONFIG, useFactory: parseDeepseekConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(DEEPSEEK_CONFIG)
}

describe("parseDeepseekConfig", () => {
    it("retries a broken JSON answer once unless told otherwise", async () => {
        await expect(read({})).resolves.toEqual({ jsonRetries: 1 })
        await expect(read({ AI_JSON_RETRIES: "3" })).resolves.toEqual({ jsonRetries: 3 })
    })
})
