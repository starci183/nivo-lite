import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import type { TextSchema, RequiredRead, OptionalAction } from "./schema-types"

/** The longest message a spec may allow. */
export const MAX_LENGTH_CEILING = 10_000

/** The longest name of a spec param. */
const PARAM_NAME_MAX = 60

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    pick: TextSchema
    idPath: z.ZodString
    textPath: z.ZodString
    authorPath: z.ZodOptional<z.ZodString>
    timePath: z.ZodOptional<z.ZodString>
    statusPath: z.ZodOptional<z.ZodString>
    sidePath: z.ZodOptional<z.ZodString>
    markPath: z.ZodOptional<z.ZodString>
    composer: z.ZodBoolean
    selectParam: z.ZodString
    maxLength: z.ZodOptional<z.ZodNumber>
}> = z.object({
    label: specText,
    empty: specText,
    pick: specText,
    idPath: z.string().max(PATH_MAX),
    textPath: z.string().max(PATH_MAX),
    authorPath: z.string().max(PATH_MAX).optional(),
    timePath: z.string().max(PATH_MAX).optional(),
    statusPath: z.string().max(PATH_MAX).optional(),
    sidePath: z.string().max(PATH_MAX).optional(),
    markPath: z.string().max(PATH_MAX).optional(),
    composer: z.boolean(),
    selectParam: z.string().min(1).max(PARAM_NAME_MAX),
    maxLength: z.number().int().min(1).max(MAX_LENGTH_CEILING).optional(),
})

/** The slots of the conversation block: the messages of the chosen thread and the three things a person may do with it. */
type Slots = {
    readonly messages: RequiredRead<"list">
    readonly send: OptionalAction
    readonly handoff: OptionalAction
    readonly close: OptionalAction
}
const slots: Slots = {
    messages: { kind: "read", shape: "list", required: true },
    send: { kind: "action", required: false },
    handoff: { kind: "action", required: false },
    close: { kind: "action", required: false },
}

/** The messages of one chosen thread with a composer under them, and the actions to hand the thread to a person or close it. */
export const conversationBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.conversation",
    title: { key: "blockConversation" },
    props,
    slots,
    params: ["selectParam"],
    children: false,
})
