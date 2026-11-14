import { Test } from "@nestjs/testing"
import { EnvSource } from "./env-source.config"

const SOURCE = Symbol("EnvSource")

const build = async (values: Readonly<Record<string, string | undefined>>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SOURCE, useFactory: () => new EnvSource(values) }],
    }).compile()
    return moduleRef.get<EnvSource>(SOURCE)
}

describe("EnvSource / optional", () => {
    it("answers the declared value", async () => {
        const source = await build({ KEY: "value" })

        expect(source.optional("KEY")).toBe("value")
    })

    it("answers undefined for a key that is missing or declared empty", async () => {
        const source = await build({ EMPTY: "" })

        expect(source.optional("EMPTY")).toBeUndefined()
        expect(source.optional("MISSING")).toBeUndefined()
    })
})
