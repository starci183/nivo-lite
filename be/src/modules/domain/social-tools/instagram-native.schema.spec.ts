import { Test } from "@nestjs/testing"
import { INSTAGRAM_MEDIA_STATUS_GET_SCHEMA } from "./instagram-native.schema"

const SUBJECT = Symbol("instagram-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { INSTAGRAM_MEDIA_STATUS_GET_SCHEMA } }],
    }).compile()
    return moduleRef.get<{ INSTAGRAM_MEDIA_STATUS_GET_SCHEMA: typeof INSTAGRAM_MEDIA_STATUS_GET_SCHEMA }>(SUBJECT)
}

describe("the Instagram container id", () => {
    it("takes 64 characters and refuses 65", async () => {
        const { INSTAGRAM_MEDIA_STATUS_GET_SCHEMA: schema } = await build()
        expect(schema.safeParse({ containerId: "c".repeat(64) }).success).toBe(true)
        expect(schema.safeParse({ containerId: "c".repeat(65) }).success).toBe(false)
    })
})
