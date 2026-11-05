import { countsRead } from "@nivo-lite/agent-sdk/module"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { THREADS } from "./threads.read"

/** The conversations per status, under the same search and channel as the list. */
export const THREAD_COUNTS: ReadDefinition = countsRead({ id: "chatbot.thread-counts", of: THREADS, by: "status" })

/** The conversations per channel, under the same search and status as the list. */
export const CHANNEL_COUNTS: ReadDefinition = countsRead({ id: "chatbot.channel-counts", of: THREADS, by: "channel" })
