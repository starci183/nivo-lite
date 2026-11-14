import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { TIKTOK_INT32_MAX, TIKTOK_PRIVACY_LEVELS, TIKTOK_PUBLISH_ID_MAX, TIKTOK_TITLE_MAX } from "@modules/integrations/tiktok"

/**
 * The bounded arguments of the TikTok destination tools. Bounds TikTok documents are cited in `integrations/tiktok`
 * (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post); a bound it does not state is NIVO's own and says so.
 */

/** NIVO's own bound of a video address (TikTok states none). */
const VIDEO_URL_MAX = 2_048

export const TIKTOK_VIDEO_PUBLISH_SCHEMA: z.ZodType<{ videoUrl: string; privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY"; title?: string | undefined; disableDuet?: boolean | undefined; disableStitch?: boolean | undefined; disableComment?: boolean | undefined; coverTimestampMs?: number | undefined; brandContentToggle?: boolean | undefined; brandOrganicToggle?: boolean | undefined; isAigc?: boolean | undefined; }> = z
    .object({
        videoUrl: z
            .url({ protocol: /^https$/u })
            .max(VIDEO_URL_MAX)
            .describe("The https address TikTok pulls the video from (PULL_FROM_URL). Its domain or URL prefix must be verified with TikTok."),
        privacyLevel: z
            .enum(TIKTOK_PRIVACY_LEVELS)
            .describe("Who may see it. Must be one of the account's `privacyLevelOptions` from `nivo.tool.tiktok.creator.info.get`."),
        title: z.string().max(TIKTOK_TITLE_MAX).optional().describe("The caption, up to 2200 UTF-16 runes; hashtags and mentions are matched. Absent = none."),
        disableDuet: z.boolean().optional().describe("Blocks Duets."),
        disableStitch: z.boolean().optional().describe("Blocks Stitches."),
        disableComment: z.boolean().optional().describe("Blocks comments."),
        coverTimestampMs: z.number().int().min(0).max(TIKTOK_INT32_MAX).optional().describe("The frame, in milliseconds, used as the cover; absent = the first frame."),
        brandContentToggle: z.boolean().optional().describe("A paid partnership promoting a third-party business."),
        brandOrganicToggle: z.boolean().optional().describe("The video promotes the creator's own business."),
        isAigc: z.boolean().optional().describe("Adds TikTok's AI-generated label."),
    })
    .strict()

export const TIKTOK_VIDEO_STATUS_GET_SCHEMA: z.ZodType<{ publishId: string; }> = z
    .object({ publishId: z.string().trim().min(1).max(TIKTOK_PUBLISH_ID_MAX).describe("The `publishId` `nivo.tool.tiktok.video.publish` answered.") })
    .strict()

export const TIKTOK_CREATOR_INFO_GET_SCHEMA: z.ZodType<{ [x: string]: never; }> = z.object({}).strict()

/** The schemas the manifest announces, generated from the validators. */
export const TIKTOK_VIDEO_PUBLISH_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TIKTOK_VIDEO_PUBLISH_SCHEMA, { io: "input" })
export const TIKTOK_VIDEO_STATUS_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TIKTOK_VIDEO_STATUS_GET_SCHEMA, { io: "input" })
export const TIKTOK_CREATOR_INFO_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TIKTOK_CREATOR_INFO_GET_SCHEMA, { io: "input" })
