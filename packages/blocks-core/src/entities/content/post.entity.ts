import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { ZodType } from "zod"
import { MAX_LINE } from "../../bounds"
import { CONTENT_CHANNELS, CONTENT_STATUSES, POST_TEXT_MAX, publishResultShape, type PublishResult } from "../../rules/content/post"

/** The largest picture or clip attached to a post, in bytes. */
export const POST_MEDIA_MAX_BYTES: number = 50 * 1024 * 1024

type PostFields = {
    readonly channel: FieldDef<"enum", false>
    readonly status: FieldDef<"enum", false>
    readonly title: FieldDef<"text", false>
    readonly brief: FieldDef<"text", false>
    readonly pillar: FieldDef<"text", false>
    readonly text: FieldDef<"text", false>
    readonly note: FieldDef<"text", false>
    readonly media: FieldDef<"file", true>
    readonly day: FieldDef<"date", true>
    readonly time: FieldDef<"text", false>
    readonly publishedAt: FieldDef<"timestamptz", true>
    readonly publishResult: FieldDef<"jsonb", true> & { readonly shape: ZodType<PublishResult> }
}

const postFields: PostFields = {
    channel: field.enum({ of: CONTENT_CHANNELS }),
    status: field.enum({ of: CONTENT_STATUSES, default: { literal: "draft" } }),
    title: field.text({ maxLength: MAX_LINE, searchable: true }),
    brief: field.text({ maxLength: POST_TEXT_MAX, default: "empty" }),
    pillar: field.text({ maxLength: MAX_LINE, default: "empty" }),
    text: field.text({ maxLength: POST_TEXT_MAX, default: "empty" }),
    note: field.text({ maxLength: POST_TEXT_MAX, default: "empty" }),
    media: field.file({ accept: ["image/*", "video/mp4"], maxBytes: POST_MEDIA_MAX_BYTES }),
    day: field.date({ nullable: true }),
    time: field.text({ maxLength: 5, default: "empty" }),
    publishedAt: field.timestamptz({ nullable: true }),
    publishResult: field.jsonb({ shape: publishResultShape, nullable: true }),
}

/**
 * One post of the content plan, for one channel: its idea (title, brief, theme), the words written for the channel, an attached picture
 * or clip (a file of the core's file store), the day and wall-clock time it is planned for in the shop's own zone, its state (a draft,
 * approved by a person, published) and what publishing answered. Graph node kind `content-post`.
 */
export const contentPostEntity: EntityDefinition<PostFields> = defineEntity({
    name: "blocks-core.content.post",
    dataKind: "content-post",
    fields: postFields,
    indexes: [
        { name: "day", on: ["day", "id"] },
        { name: "status_day", on: ["status", "day", "id"] },
        { name: "channel_day", on: ["channel", "day", "id"] },
    ],
})
