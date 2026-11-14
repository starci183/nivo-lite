import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { channelHashtagsOf, draftGoalOf, postTextOf } from "../../rules/content/channels"
import { CONTENT_CHANNELS, POST_TEXT_MAX, type ContentChannel } from "../../rules/content/post"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { BRAND_LIST_ARGS, POST_TYPE, brandOf, postOfGet, recordAnswerOf } from "./content.reads"

type NoParams = Record<string, never>

/** The post to write. */
export interface DraftInput {
    /** The post. */
    readonly postId: string
}

/** The post as written. */
export interface DraftOutput {
    /** The post. */
    readonly postId: string
    /** The social channel. */
    readonly channel: ContentChannel
    /** The title of the post. */
    readonly title: string
    /** The words of the post, hashtags included. */
    readonly text: string
    /** True when a person declined saving the words on the post's card: the post keeps no words. */
    readonly declined: boolean
}

/** The most hashtags the writer may answer, before the channel's own limit. */
const HASHTAGS_MAX = 20

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<DraftInput> = z.object({ postId: z.string().min(1).max(MAX_ID) })
const output: NodeSchema<DraftOutput> = z.object({
    postId: z.string().min(1).max(MAX_ID).describe("The post written."),
    channel: z.enum(CONTENT_CHANNELS).describe("The channel it is written for."),
    title: z.string().max(MAX_LINE).describe("Its title."),
    text: z.string().max(POST_TEXT_MAX).describe("The words saved on the post, hashtags included."),
    declined: z.boolean().describe("True when a person declined saving the words on the post's card: the post was not written."),
})

/** What the writer answers. */
const writtenSchema = z.object({
    text: z.string().min(1).max(POST_TEXT_MAX).describe("The post text in Vietnamese, without hashtags"),
    hashtags: z.array(z.string().max(MAX_LINE)).max(HASHTAGS_MAX).describe("The hashtags, each starting with #"),
    note: z.string().max(MAX_LINE).describe("A short note for the owner: a picture or filming suggestion"),
})

/** The post of the examples, as the record get answers it. */
const POST = recordAnswerOf("post-1", {
    channel: "zalo",
    status: "draft",
    title: "Flowers to thank a teacher",
    brief: "A small bouquet",
    pillar: "Fresh flowers",
    text: "",
    day: "2026-11-19",
    time: "10:00",
})

/** The words of the examples' post. */
const WRITTEN = "Teachers' Day is close: small bouquets to say thank you."

/**
 * `content.draft`: writes one post for its channel. The agent reads the post's idea, the brand (voice, limits, themes) and the
 * channel's writing rules, searches the Second Brain for the facts it may state, and answers the words, the hashtags and a note for the
 * owner; the hashtags are kept within the channel's limit (the brand's added on TikTok and Instagram) and the words are saved on the
 * post, which stays a draft until a person approves it.
 */
export const contentDraftNode: TemplateNode<
    NodeSchema<DraftInput>,
    NodeSchema<DraftOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "content.draft",
    title: bilingualOf("nodeContentDraftTitle"),
    description: { vi: "Vi\u1ebft n\u1ed9i dung m\u1ed9t b\u00e0i \u0111\u0103ng cho k\u00eanh c\u1ee7a n\u00f3 theo gi\u1ecdng th\u01b0\u01a1ng hi\u1ec7u, k\u00e8m hashtag v\u00e0 ghi ch\u00fa cho ch\u1ee7 c\u1eeda h\u00e0ng. B\u00e0i v\u1eabn l\u00e0 b\u1ea3n nh\u00e1p \u0111\u1ebfn khi c\u00f3 ng\u01b0\u1eddi duy\u1ec7t.", en: "Writes one post for its channel in the brand's voice, with hashtags and a note for the owner. It stays a draft until a person approves it." },
    tools: [],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const post = postOfGet(
            valueOrCannot(
                context,
                TOOL.recordGet,
                await context.tools.call(TOOL.recordGet, { type: POST_TYPE, id: given.postId }),
            ),
        )
        const brand = await brandOf(context)
        const written = await context.agent.run({
            goal: draftGoalOf(brand, post.channel),
            input: { title: post.title, brief: post.brief, theme: post.pillar, day: post.day, time: post.time },
            output: writtenSchema,
            maxTurns: 6,
        })
        const text = postTextOf(written.text, channelHashtagsOf(post.channel, written.hashtags, brand.hashtags))
        const saved = await context.tools.call(TOOL.recordUpdate, {
            type: POST_TYPE,
            id: post.id,
            patch: { text, note: written.note },
        })
        if (!saved.ok && saved.declined === true) return { postId: post.id, channel: post.channel, title: post.title, text: "", declined: true }
        valueOrCannot(context, TOOL.recordUpdate, saved)
        return { postId: post.id, channel: post.channel, title: post.title, text, declined: false }
    },
    examples: [
        {
            name: "writes the Zalo post from its idea and the brand, with no hashtag on Zalo",
            params: {},
            input: { postId: "post-1" },
            tools: [
                { id: TOOL.recordGet, args: { type: POST_TYPE, id: "post-1" }, answer: answered({ record: POST }) },
                { id: TOOL.recordList, args: BRAND_LIST_ARGS, answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordUpdate,
                    args: { type: POST_TYPE, id: "post-1", patch: { text: WRITTEN, note: "A bouquet on a table" } },
                    answer: answered({ record: POST }),
                },
            ],
            agent: [{ answer: { text: WRITTEN, hashtags: ["#flowers"], note: "A bouquet on a table" } }],
            output: { postId: "post-1", channel: "zalo", title: "Flowers to thank a teacher", text: WRITTEN, declined: false },
        },
        {
            name: "a person declined saving the words: the post keeps none",
            params: {},
            input: { postId: "post-1" },
            tools: [
                { id: TOOL.recordGet, args: { type: POST_TYPE, id: "post-1" }, answer: answered({ record: POST }) },
                { id: TOOL.recordList, args: BRAND_LIST_ARGS, answer: answered({ records: [], next: null }) },
                {
                    id: TOOL.recordUpdate,
                    args: { type: POST_TYPE, id: "post-1", patch: { text: WRITTEN, note: "A bouquet on a table" } },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { text: WRITTEN, hashtags: ["#flowers"], note: "A bouquet on a table" } }],
            output: { postId: "post-1", channel: "zalo", title: "Flowers to thank a teacher", text: "", declined: true },
        },
        {
            name: "a post that is gone: the step cannot write it",
            params: {},
            input: { postId: "post-gone" },
            tools: [{ id: TOOL.recordGet, args: { type: POST_TYPE, id: "post-gone" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: `${TOOL.recordGet} refused: not_found` },
        },
    ],
})
