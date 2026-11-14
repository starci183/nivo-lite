import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_LINE } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"

/** The notice of a confirmed booking, as `booking.confirm-tell` wrote it. */
export interface ConfirmNotifyInput {
    /** The heading. */
    readonly title: string
    /** The words: who booked, the service, the time in the shop's zone, the party. */
    readonly text: string
}

/** Whether the team was told. */
export interface ConfirmNotifyOutput {
    /** `posted` the notice is in the team's room; `declined` a person declined the post on its card. */
    readonly result: "posted" | "declined"
}

const input: NodeSchema<ConfirmNotifyInput> = z.object({
    title: z.string().min(1).max(MAX_LINE),
    text: z.string().min(1).max(2_000),
})

const output: NodeSchema<ConfirmNotifyOutput> = z.object({
    result: z.enum(["posted", "declined"]).describe("`posted` once the team is told; `declined` when a person declined the post."),
})

/** The post as `nivo.tool.team.message.post` takes it: plain words (`message.text`) telling (`notify`) the agent's own room. */
const noticeOf = (given: ConfirmNotifyInput): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "own",
    title: given.title,
    text: given.text,
})

const TEAM = { title: "New booking", text: "Hoa, 9:00 Monday 16/11, 1 person." }

/**
 * `booking.confirm-notify` (tell the team the booking is confirmed): posts the notice `booking.confirm-tell` wrote to the agent's own
 * room (`nivo.tool.team.message.post`, its ONE write; no AI call). A post a person declined on its card is their decision
 * (`declined`), never a failure. A side node (`blocking: false`), as the post was a side line of the old confirmation: any other
 * refusal ends the step (`cannot`) and the engine passes it over with one team message; the booking stays confirmed and told.
 */
export const bookingConfirmNotifyNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "booking.confirm-notify",
    title: bilingualOf("nodeBookingConfirmNotifyTitle"),
    description: {
        vi: "\u0110\u0103ng d\u00f2ng b\u00e1o l\u1ecbch h\u1eb9n \u0111\u00e3 x\u00e1c nh\u1eadn v\u00e0o ph\u00f2ng c\u1ee7a \u0111\u1ed9i.",
        en: "Posts the notice of the confirmed booking in the team's room.",
    },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const posted = await context.tools.call(TOOL.teamMessagePost, noticeOf(given))
        if (!posted.ok && posted.declined === true) return { result: "declined" }
        valueOrCannot(context, TOOL.teamMessagePost, posted)
        return { result: "posted" }
    },
    examples: [
        {
            name: "posts the notice of the confirmed booking to the team",
            params: {},
            input: TEAM,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(TEAM), answer: answered({ messageId: "m2" }) }],
            output: { result: "posted" },
        },
        {
            name: "a person declined the post on its card: the team is not told, the step says declined",
            params: {},
            input: TEAM,
            tools: [{ id: TOOL.teamMessagePost, args: noticeOf(TEAM), answer: refused("declined") }],
            output: { result: "declined" },
        },
    ],
})
