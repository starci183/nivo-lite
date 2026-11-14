import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import {
    YOUTUBE_DESCRIPTION_MAX_BYTES,
    YOUTUBE_PRIVACY_STATUSES,
    YOUTUBE_TAGS_MAX_CHARS,
    YOUTUBE_TITLE_MAX,
} from "@modules/integrations/youtube"
import { tagsLengthOf } from "./youtube-tags.policy"

/**
 * The arguments of the YouTube destination tools. Bounds from https://developers.google.com/youtube/v3/docs/videos: title at most 100
 * characters, description at most 5000 bytes, both with no `<` or `>`; tags at most 500 characters in total (commas count, a tag with a
 * space counts as if wrapped in quotation marks); `status.privacyStatus` private | public | unlisted; `status.publishAt` ISO 8601 and
 * only for a video that stays private. The category id is one of `videoCategories.list` (YouTube's to judge).
 */

/** A file of the file store, named by the id of its stored member. */
const fileId = z.string().trim().min(1).max(200)

/** A YouTube video or playlist id as a query value takes it (the same shape the client sends). */
const youtubeId = z.string().max(128).regex(/^[A-Za-z0-9_-]{1,128}$/u)

export const YOUTUBE_VIDEO_PUBLISH_SCHEMA: z.ZodType<{ videoFileId: string; title: string; description?: string | undefined; tags?: Array<string> | undefined; categoryId?: string | undefined; privacyStatus?: "private" | "public" | "unlisted" | undefined; publishAt?: string | undefined; madeForKids?: boolean | undefined; notifySubscribers?: boolean | undefined; thumbnailFileId?: string | undefined; playlistId?: string | undefined; }> = z
    .object({
        videoFileId: fileId.describe("The video, as a file of the file store (the `stored` member of a file reference)."),
        title: z.string().trim().min(1).max(YOUTUBE_TITLE_MAX).regex(/^[^<>]*$/u).describe("The title (up to 100 characters, no < or >)."),
        description: z
            .string()
            .max(YOUTUBE_DESCRIPTION_MAX_BYTES)
            .refine((text) => Buffer.byteLength(text, "utf8") <= YOUTUBE_DESCRIPTION_MAX_BYTES, { message: "description bytes" })
            .refine((text) => /^[^<>]*$/u.test(text), { message: "description angle brackets" })
            .optional()
            .describe("The description (up to 5000 bytes, no < or >)."),
        tags: z
            .array(z.string().trim().min(1).max(YOUTUBE_TAGS_MAX_CHARS))
            .max(YOUTUBE_TAGS_MAX_CHARS)
            .refine((tags) => tagsLengthOf(tags) <= YOUTUBE_TAGS_MAX_CHARS, { message: "tags total length" })
            .optional()
            .describe("The keywords (up to 500 characters in total, commas counted)."),
        categoryId: z.string().trim().min(1).max(20).optional().describe("The video category id (from YouTube's category list)."),
        privacyStatus: z.enum(YOUTUBE_PRIVACY_STATUSES).optional().describe("private, public or unlisted; absent for YouTube's default (public)."),
        publishAt: z.iso.datetime({ offset: true }).max(64).optional().describe("When a private video goes public (ISO 8601)."),
        madeForKids: z.boolean().optional().describe("Whether the video is made for kids."),
        notifySubscribers: z.boolean().optional().describe("Whether subscribers are notified (YouTube's default is yes)."),
        thumbnailFileId: fileId.describe("A custom thumbnail, as a file of the file store.").optional(),
        playlistId: youtubeId.describe("The playlist to add the video to.").optional(),
    })
    .strict()
    .refine((asked) => asked.publishAt === undefined || asked.privacyStatus === "private", { message: "publishAt needs privacyStatus private" })

export const YOUTUBE_VIDEO_STATUS_GET_SCHEMA: z.ZodType<{ videoId: string; }> = z.object({ videoId: youtubeId.describe("The video, as the publish call answered it.") }).strict()

/** The schemas the manifest announces, generated from the validators. */
export const YOUTUBE_VIDEO_PUBLISH_INPUT_SCHEMA: ToolJson = z.toJSONSchema(YOUTUBE_VIDEO_PUBLISH_SCHEMA, { io: "input", unrepresentable: "any" })
export const YOUTUBE_VIDEO_STATUS_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(YOUTUBE_VIDEO_STATUS_GET_SCHEMA, { io: "input" })
