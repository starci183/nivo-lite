import { Test } from "@nestjs/testing"
import { CREATOMATE_API_KEY, creatomateKeyOf } from "./creatomate-credential.service"

const SUBJECT = Symbol("creatomate-credential.service")

const keyReaderOf = async (): Promise<typeof creatomateKeyOf> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: creatomateKeyOf }],
    }).compile()
    return moduleRef.get<typeof creatomateKeyOf>(SUBJECT)
}

describe("creatomateKeyOf (a sealed secret's plain text)", () => {
    it("reads the trimmed key of a secret that holds one", async () => {
        const keyOf = await keyReaderOf()

        expect(keyOf(JSON.stringify({ [CREATOMATE_API_KEY]: "  secret-key " }))).toBe("secret-key")
    })

    it.each(["not json", "[]", "7", "{}", JSON.stringify({ [CREATOMATE_API_KEY]: "   " }), JSON.stringify({ [CREATOMATE_API_KEY]: 7 })])(
        "reads no key from %s",
        async (plain) => {
            const keyOf = await keyReaderOf()

            expect(keyOf(plain)).toBeNull()
        },
    )
})
