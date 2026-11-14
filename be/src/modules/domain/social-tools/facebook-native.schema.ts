import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/**
 * The arguments of `nivo.tool.facebook.post.publish`: ONE contract for a Page post in all its forms (text, link, photo, video), Facebook's
 * own. Bounds the documentation states are cited; the Graph reference pages state NO maximum length for a message, caption or title, so
 * those bounds are NIVO's own and say so.
 *  - "You must provide `link` or `message`" for a feed post (https://developers.facebook.com/docs/graph-api/reference/page/feed/).
 *  - A photo takes `url` ("You must specify this or a file attachment") and `caption`
 *    (https://developers.facebook.com/docs/graph-api/reference/page/photos/); a video takes `file_url`, `description`, `title`
 *    (https://developers.facebook.com/docs/graph-api/reference/page/videos/).
 */

/** NIVO's own bound of a message, caption or description (the reference pages state none). */
export const FACEBOOK_TEXT_MAX = 10_000

/** NIVO's own bound of a video title (the reference page states none). */
export const FACEBOOK_TITLE_MAX = 255

const address = z.url({ protocol: /^https$/u }).max(2048)

export const FACEBOOK_POST_PUBLISH_SCHEMA: z.ZodType<{ message?: string | undefined; link?: string | undefined; media?: { kind: "photo" | "video"; url: string; title?: string | undefined; } | undefined; }> = z
    .object({
        message: z.string().trim().min(1).max(FACEBOOK_TEXT_MAX).optional().describe("The post's text; a photo's caption; a video's description."),
        link: address.describe("A link the post attaches (not with media).").optional(),
        media: z
            .object({
                kind: z.enum(["photo", "video"]).describe("One photo or one video."),
                url: address.describe("The public https address Meta fetches the file from."),
                title: z.string().trim().min(1).max(FACEBOOK_TITLE_MAX).optional().describe("The video's title (a video only)."),
            })
            .strict()
            .optional()
            .describe("One photo or one video of the post."),
    })
    .strict()
    .refine((asked) => asked.message !== undefined || asked.link !== undefined || asked.media !== undefined, { message: "message, link or media" })
    .refine((asked) => asked.media === undefined || asked.link === undefined, { message: "link with media" })
    .refine((asked) => asked.media === undefined || asked.media.kind === "video" || asked.media.title === undefined, { message: "title of a photo" })

/** The schema the manifest announces, generated from the validator. */
export const FACEBOOK_POST_PUBLISH_INPUT_SCHEMA: ToolJson = z.toJSONSchema(FACEBOOK_POST_PUBLISH_SCHEMA, { io: "input", unrepresentable: "any" })
