import { countsRead } from "@nivo-lite/agent-sdk/module"
import { defineRead, timeWindowOf } from "@nivo-lite/agent-sdk/block"
import type { CountsResult, ListQuery, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { CHATBOT_CHANNELS } from "../../../rules/chatbot"
import { THREADS_LIST } from "../ports"
import { THREADS, THREADS_SHAPE } from "./threads.read"

const LIST_SEARCH_MAX = 200

const variables: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>
    channel: z.ZodOptional<z.ZodEnum<{ [K in (typeof CHATBOT_CHANNELS)[number] | "all"]: K }>>
}> = z.object({
    q: z.string().max(LIST_SEARCH_MAX).optional(),
    channel: z.enum([...CHATBOT_CHANNELS, "all"]).optional(),
})

/** The conversations a count by status adds up to. */
const sum = (counts: Readonly<Record<string, number>>): number =>
    Object.values(counts).reduce((total, count) => total + count, 0)

/**
 * `chatbot.thread-counts`: the conversations per status under the same search and channel as the list, and under the key `today` the
 * conversations that moved in the window `$today` names at the clock of the run, so the Today tab carries a count like the others.
 * `total` is every conversation under the search and channel.
 */
export const THREAD_COUNTS: ReadDefinition = defineRead({
    id: "chatbot.thread-counts",
    dataKind: "conversation",
    shape: "record",
    fields: ["counts", "total"],
    paths: { counts: "record" },
    variables,
    permission: "chatbot.view",
    ports: { threads: THREADS_LIST },
    run: async ({ threads }, given, context): Promise<CountsResult> => {
        const text = given.q?.trim() ?? ""
        const query: ListQuery = {
            q: text === "" ? null : text,
            filters: given.channel === undefined || given.channel === "all" ? {} : { channel: given.channel },
            sort: "recent",
            cursor: null,
            size: THREADS_SHAPE.page.size,
        }
        const byStatus = await threads.counts(THREADS_SHAPE, "status", query)
        const withinToday = await threads.counts(THREADS_SHAPE, "status", {
            ...query,
            windows: { moved: timeWindowOf("$today", context.now) },
        })
        return { counts: { ...byStatus, today: sum(withinToday) }, total: sum(byStatus) }
    },
})

/** The conversations per channel, under the same search and status as the list. */
export const CHANNEL_COUNTS: ReadDefinition = countsRead({ id: "chatbot.channel-counts", of: THREADS, by: "channel" })
