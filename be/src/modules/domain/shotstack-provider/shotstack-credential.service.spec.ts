import { Test } from "@nestjs/testing"
import { SHOTSTACK_API_KEY, shotstackKeyOf } from "./shotstack-credential.service"

const SUBJECT = Symbol("shotstack-credential.service")

const keyReaderOf = async (): Promise<typeof shotstackKeyOf> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { shotstackKeyOf } }],
    }).compile()
    return moduleRef.get<{ readonly shotstackKeyOf: typeof shotstackKeyOf }>(SUBJECT).shotstackKeyOf
}

describe("shotstackKeyOf (a sealed secret's plain text)", () => {
    it("reads the trimmed key of a secret that holds one", async () => {
        const keyOf = await keyReaderOf()

        expect(keyOf(JSON.stringify({ [SHOTSTACK_API_KEY]: "  secret-key " }))).toBe("secret-key")
    })

    it.each(["not json", "[]", "7", "{}", JSON.stringify({ [SHOTSTACK_API_KEY]: "   " }), JSON.stringify({ [SHOTSTACK_API_KEY]: 7 })])(
        "reads no key from %s",
        async (plain) => {
            const keyOf = await keyReaderOf()

            expect(keyOf(plain)).toBeNull()
        },
    )
})
