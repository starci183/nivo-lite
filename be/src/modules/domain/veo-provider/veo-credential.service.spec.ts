import { Test } from "@nestjs/testing"
import { VEO_API_KEY, veoKeyOf } from "./veo-credential.service"

const SUBJECT = Symbol("veo-credential.service")

const keyReaderOf = async (): Promise<typeof veoKeyOf> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: veoKeyOf }],
    }).compile()
    return moduleRef.get<typeof veoKeyOf>(SUBJECT)
}

describe("veoKeyOf (a sealed secret's plain text)", () => {
    it("reads the trimmed key of a secret that holds one", async () => {
        const keyOf = await keyReaderOf()

        expect(keyOf(JSON.stringify({ [VEO_API_KEY]: "  secret-key " }))).toBe("secret-key")
    })

    it.each(["not json", "[]", "7", "{}", JSON.stringify({ [VEO_API_KEY]: "   " }), JSON.stringify({ [VEO_API_KEY]: 7 })])(
        "reads no key from %s",
        async (plain) => {
            const keyOf = await keyReaderOf()

            expect(keyOf(plain)).toBeNull()
        },
    )
})
