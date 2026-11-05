import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import { paramName } from "./param-name"
import type { OptionalRead } from "./form.block"
import type { TextSchema, RequiredRead, OptionalAction } from "./schema-types"

/** The longest message a spec may allow. */
export const MAX_LENGTH_CEILING = 10_000

type HeadSchema = z.ZodObject<{
    titlePath: z.ZodString
    subtitlePath: z.ZodOptional<z.ZodString>
}>

const head: HeadSchema = z.object({
    titlePath: z.string().max(PATH_MAX),
    subtitlePath: z.string().max(PATH_MAX).optional(),
})

type ProposalSchema = z.ZodObject<{
    title: TextSchema
    idPath: z.ZodString
    askedPath: z.ZodOptional<z.ZodString>
    textPath: z.ZodString
    notePath: z.ZodOptional<z.ZodString>
    saveLabel: TextSchema
    cancelLabel: TextSchema
}>

const proposal: ProposalSchema = z.object({
    title: specText,
    idPath: z.string().max(PATH_MAX),
    askedPath: z.string().max(PATH_MAX).optional(),
    textPath: z.string().max(PATH_MAX),
    notePath: z.string().max(PATH_MAX).optional(),
    saveLabel: specText,
    cancelLabel: specText,
})

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
    head: z.ZodOptional<HeadSchema>
    proposal: z.ZodOptional<ProposalSchema>
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
    selectParam: paramName,
    maxLength: z.number().int().min(1).max(MAX_LENGTH_CEILING).optional(),
    head: head.optional(),
    proposal: proposal.optional(),
})

/**
 * The slots of the conversation block: the messages of the chosen thread, the thread itself for its head, a reply proposed and
 * waiting for approval, and the things a person may do with the thread or the proposal.
 */
type Slots = {
    readonly messages: RequiredRead<"list">
    readonly thread: OptionalRead<"record">
    readonly proposal: OptionalRead<"record">
    readonly send: OptionalAction
    readonly handoff: OptionalAction
    readonly close: OptionalAction
    readonly approve: OptionalAction
    readonly edit: OptionalAction
    readonly reject: OptionalAction
}
const slots: Slots = {
    messages: { kind: "read", shape: "list", required: true },
    thread: { kind: "read", shape: "record", required: false },
    proposal: { kind: "read", shape: "record", required: false },
    send: { kind: "action", required: false },
    handoff: { kind: "action", required: false },
    close: { kind: "action", required: false },
    approve: { kind: "action", required: false },
    edit: { kind: "action", required: false },
    reject: { kind: "action", required: false },
}

/**
 * The messages of one chosen thread with a composer under them, a head that names the thread (its avatar, name and a line under it),
 * a reply proposed for the person to approve, change or refuse, and the actions to hand the thread to a person or close it.
 */
export const conversationBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.conversation",
    title: { key: "blockConversation" },
    props,
    slots,
    params: ["selectParam"],
    children: false,
})
