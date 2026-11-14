import { Test } from "@nestjs/testing"
import { YOUTUBE_VIDEO_PUBLISH_SCHEMA, YOUTUBE_VIDEO_STATUS_GET_SCHEMA } from "./youtube-native.schema"

const SUBJECT = Symbol("youtube-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { YOUTUBE_VIDEO_PUBLISH_SCHEMA, YOUTUBE_VIDEO_STATUS_GET_SCHEMA } }],
    }).compile()
    return moduleRef.get<{
        YOUTUBE_VIDEO_PUBLISH_SCHEMA: typeof YOUTUBE_VIDEO_PUBLISH_SCHEMA
        YOUTUBE_VIDEO_STATUS_GET_SCHEMA: typeof YOUTUBE_VIDEO_STATUS_GET_SCHEMA
    }>(SUBJECT)
}

const VIDEO = { videoFileId: "file-1", title: "A title" }
const PRIVATE = { ...VIDEO, privacyStatus: "private" as const }

describe("the YouTube tool schemas", () => {
    it("take a description of 5000 characters and refuse 5001 (a character is at least one byte)", async () => {
        const { YOUTUBE_VIDEO_PUBLISH_SCHEMA: schema } = await build()
        expect(schema.safeParse({ ...VIDEO, description: "d".repeat(5000) }).success).toBe(true)
        expect(schema.safeParse({ ...VIDEO, description: "d".repeat(5001) }).success).toBe(false)
    })

    it("take tags that total at most 500 characters and refuse a tag of 501", async () => {
        const { YOUTUBE_VIDEO_PUBLISH_SCHEMA: schema } = await build()
        expect(schema.safeParse({ ...VIDEO, tags: ["t".repeat(500)] }).success).toBe(true)
        expect(schema.safeParse({ ...VIDEO, tags: ["t".repeat(501)] }).success).toBe(false)
    })

    it("take a publish moment of 64 characters and a video id of 128, and refuse longer", async () => {
        const { YOUTUBE_VIDEO_PUBLISH_SCHEMA: publish, YOUTUBE_VIDEO_STATUS_GET_SCHEMA: status } = await build()
        expect(publish.safeParse({ ...PRIVATE, publishAt: "2026-11-20T09:00:00+07:00" }).success).toBe(true)
        expect(publish.safeParse({ ...PRIVATE, publishAt: `2026-11-20T09:00:00.${"1".repeat(60)}+07:00` }).success).toBe(false)
        expect(status.safeParse({ videoId: "v".repeat(128) }).success).toBe(true)
        expect(status.safeParse({ videoId: "v".repeat(129) }).success).toBe(false)
    })
})
