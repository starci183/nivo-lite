import { Test } from "@nestjs/testing"
import { ELEVENLABS_API_KEY, elevenLabsKeyOf } from "./elevenlabs-credential.service"

const SUBJECT = Symbol("elevenlabs-credential.service")

const keyReaderOf = async (): Promise<typeof elevenLabsKeyOf> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: elevenLabsKeyOf }],
    }).compile()
    return moduleRef.get<typeof elevenLabsKeyOf>(SUBJECT)
}

describe("elevenLabsKeyOf (a sealed secret's plain text)", () => {
    it("reads the trimmed key of a secret that holds one", async () => {
        const keyOf = await keyReaderOf()

        expect(keyOf(JSON.stringify({ [ELEVENLABS_API_KEY]: "  secret-key " }))).toBe("secret-key")
    })

    it.each(["not json", "[]", "7", "{}", JSON.stringify({ [ELEVENLABS_API_KEY]: "   " }), JSON.stringify({ [ELEVENLABS_API_KEY]: 7 })])(
        "reads no key from %s",
        async (plain) => {
            const keyOf = await keyReaderOf()

            expect(keyOf(plain)).toBeNull()
        },
    )
})
