import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { INSTAGRAM_CAROUSEL_MAX } from "@modules/integrations/meta-publishing"
import { INSTAGRAM_MEDIA_FIELDS } from "./instagram-media.policy"

/**
 * The arguments of the Instagram destination tools. Bounds the documentation states (https://developers.facebook.com/docs/instagram-platform/content-publishing):
 * a carousel holds "up to 20" items (`children`); the media is a public address Meta fetches ("publicly accessible at publish time"); the
 * media types are image (no `media_type`), `VIDEO`, `REELS`, `CAROUSEL`. The page states NO caption length, so the caption bound is NIVO's own.
 */

/** NIVO's own bound of a caption (the content publishing page states none). */
export const INSTAGRAM_CAPTION_MAX = 2200

/** NIVO's own bound of an alternative text (the page names `alt_text` and states no length). */
export const INSTAGRAM_ALT_TEXT_MAX = 1000

const address = z.url({ protocol: /^https$/u }).max(2048)

/** A container id as Graph answers it and takes it back: letters, digits and underscores. */
const containerId = z.string().max(64).regex(/^\w{1,64}$/u).describe("The container, as the publish call answered it.")

export const INSTAGRAM_MEDIA_PUBLISH_SCHEMA: z.ZodType<{ containerId?: string | undefined; mediaType?: "video" | "image" | "reels" | "carousel" | undefined; caption?: string | undefined; mediaUrl?: string | undefined; children?: Array<{ kind: "video" | "image"; url: string; }> | undefined; altText?: string | undefined; aiGenerated?: boolean | undefined; }> = z
    .object({
        containerId: containerId.optional().describe("To finish a container an earlier call left pending: no other member then."),
        mediaType: z.enum(["image", "video", "reels", "carousel"]).optional().describe("The kind of media."),
        caption: z.string().trim().min(1).max(INSTAGRAM_CAPTION_MAX).optional().describe("The caption."),
        mediaUrl: address.describe("The public https address of the image, video or reel (not for a carousel).").optional(),
        children: z
            .array(
                z
                    .object({ kind: z.enum(["image", "video"]), url: address.describe("The public https address of the item.") })
                    .strict(),
            )
            .min(1)
            .max(INSTAGRAM_CAROUSEL_MAX)
            .optional()
            .describe("The items of a carousel, in order (up to 20)."),
        altText: z.string().trim().min(1).max(INSTAGRAM_ALT_TEXT_MAX).optional().describe("An image's alternative text (an image only)."),
        aiGenerated: z.boolean().optional().describe("Whether the post discloses that AI made it."),
    })
    .strict()
    .refine((asked) => (asked.containerId === undefined ? asked.mediaType !== undefined : INSTAGRAM_MEDIA_FIELDS.every((field) => asked[field] === undefined)), {
        message: "either containerId alone, or mediaType with its media",
    })
    .refine((asked) => asked.containerId !== undefined || (asked.mediaType === "carousel" ? asked.children !== undefined && asked.mediaUrl === undefined : asked.mediaUrl !== undefined && asked.children === undefined), {
        message: "mediaUrl for image, video and reels; children for a carousel",
    })
    .refine((asked) => asked.altText === undefined || asked.mediaType === "image", { message: "altText of an image only" })

export const INSTAGRAM_MEDIA_STATUS_GET_SCHEMA: z.ZodType<{ containerId: string; }> = z.object({ containerId }).strict()

/** The schemas the manifest announces, generated from the validators. */
export const INSTAGRAM_MEDIA_PUBLISH_INPUT_SCHEMA: ToolJson = z.toJSONSchema(INSTAGRAM_MEDIA_PUBLISH_SCHEMA, { io: "input", unrepresentable: "any" })
export const INSTAGRAM_MEDIA_STATUS_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(INSTAGRAM_MEDIA_STATUS_GET_SCHEMA, { io: "input" })
