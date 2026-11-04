import { parseJsonText } from "@modules/platform/primitives"
import { wakeInboundSchema } from "./wake-inbound.schema"
import type { AgentWakeInbound, OptionalAgentWakeInbound, OptionalInboundText } from "./agent-wake-rules.contracts"

/** The event of an inbound wake as the text a context keeps. */
export const encodeInbound = (inbound: AgentWakeInbound): string => JSON.stringify(inbound)

/** The event a context text holds, or undefined when there is none or it is not an event: a wake never throws on its own context. */
export const decodeInbound = (text: OptionalInboundText): OptionalAgentWakeInbound => {
    if (text === undefined) return undefined
    const read = parseJsonText(text)
    if (!read.ok) return undefined
    const parsed = wakeInboundSchema.safeParse(read.value)
    return parsed.success ? parsed.data : undefined
}
