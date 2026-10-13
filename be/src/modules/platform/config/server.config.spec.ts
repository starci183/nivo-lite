import { Test } from "@nestjs/testing"
import { EnvSource } from "./env-source.config"
import { parseServerConfig } from "./server.config"

const SERVER_CONFIG = Symbol("SERVER_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: SERVER_CONFIG, useFactory: parseServerConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(SERVER_CONFIG)
}

describe("parseServerConfig", () => {
    it("reads the port the process listens on", async () => {
        await expect(read({ PORT: "3000" })).resolves.toEqual({ port: 3000 })
    })
})
