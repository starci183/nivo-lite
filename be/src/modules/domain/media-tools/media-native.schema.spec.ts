import { Test } from "@nestjs/testing"
import { SPEECH_GENERATE_SCHEMA } from "./media-native.schema"

const SUBJECT = Symbol("media-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: SPEECH_GENERATE_SCHEMA }],
    }).compile()
    return moduleRef.get<typeof SPEECH_GENERATE_SCHEMA>(SUBJECT)
}

describe("the language code of the media tools", () => {
    it("takes two or three letters and refuses four", async () => {
        const schema = await build()
        const speak = { text: "Xin chao", voiceId: "v1" }
        expect(schema.safeParse({ ...speak, languageCode: "vi" }).success).toBe(true)
        expect(schema.safeParse({ ...speak, languageCode: "vie" }).success).toBe(true)
        expect(schema.safeParse({ ...speak, languageCode: "viet" }).success).toBe(false)
    })
})
