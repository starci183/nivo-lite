import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import type { RequiredRead, TextSchema } from "./schema-types"

type ModesSchema = z.ZodObject<{ auto: TextSchema; ask: TextSchema; none: TextSchema }>

const modes: ModesSchema = z.object({ auto: specText, ask: specText, none: specText })

type StatesSchema = z.ZodObject<{ connected: TextSchema; attention: TextSchema; off: TextSchema }>

const states: StatesSchema = z.object({ connected: specText, attention: specText, off: specText })

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    linkLabel: TextSchema
    linkPath: z.ZodString
    modes: ModesSchema
    states: StatesSchema
}> = z.object({
    label: specText,
    empty: specText,
    linkLabel: specText,
    linkPath: z.string().min(1).max(PATH_MAX),
    modes,
    states,
})

/** The slots of the reach card: what the agent is attached to and may do. */
type Slots = {
    readonly reach: RequiredRead<"record">
}
const slots: Slots = { reach: { kind: "read", shape: "record", required: true } }

/**
 * What an agent may touch (`platform.agent-reach`), for any agent and any provider: one row per attached account (its name, its
 * provider, its state as a chip without a dot), then one row per mode that holds operations (does by itself, asks first, never does),
 * the operation titles joined, the mode as a chip. The head link (`linkLabel`, `linkPath` beside the page) opens the agent's rights.
 */
export const reachCardBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.reach-card",
    title: { key: "blockReachCard" },
    props,
    slots,
    children: false,
})
