import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { tagTextOf } from "./handoff.policy"
import type { ContextValue, HandoffInput, HandoffOutput, HandoffParams } from "./handoff.types"

const TARGET_MAX = 120
const TEXT_MAX = 2000
const CONTEXT_KEYS_MAX = 40

const contextValue: NodeSchema<ContextValue> = z.union([z.string().max(TEXT_MAX), z.number(), z.boolean(), z.null()])

const params: NodeSchema<HandoffParams> = z.object({ toAgentKey: z.string().min(1).max(TARGET_MAX) })

const input: NodeSchema<HandoffInput> = z.object({
    text: z.string().min(1).max(TEXT_MAX),
    conversationId: z.string().min(1).max(TARGET_MAX).nullable(),
    context: z
        .record(z.string().max(TARGET_MAX), contextValue)
        .refine((entries) => Object.keys(entries).length <= CONTEXT_KEYS_MAX)
        .nullable(),
})

const output: NodeSchema<HandoffOutput> = z.object({
    toAgentKey: z.string(),
    tag: z.object({ kind: z.string(), id: z.string() }),
})

/** `core.handoff`: tags another agent of the workspace with a note and the context of the turn. The agent to tag is a param of the graph. */
export const coreHandoffNode: NodeDefinition<
    NodeSchema<HandoffInput>,
    NodeSchema<HandoffOutput>,
    NodeSchema<HandoffParams>
> = defineNode({
    id: "core.handoff",
    role: "output",
    title: { vi: "Chuyển cho agent khác", en: "Hand off to another agent" },
    params,
    input,
    output,
    rights: [],
    effects: ["agent.tag"],
    run: async (given, context) => {
        const tag = await context.effect("agent.tag", {
            toModuleKey: context.params.toAgentKey,
            text: tagTextOf(given),
            ...(given.conversationId === null ? {} : { conversationId: given.conversationId }),
            ...(context.turn.subject === null ? {} : { subject: context.turn.subject }),
        })
        return { toAgentKey: context.params.toAgentKey, tag }
    },
    examples: [
        {
            name: "tags the target agent with the note and the context",
            params: { toAgentKey: "sales" },
            input: {
                text: "Khách muốn đặt 1 chậu hoa",
                conversationId: "c1",
                context: { intent: "order", address: "69 Hàng Xanh" },
            },
            output: { toAgentKey: "sales", tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "sales",
                        text: 'Khách muốn đặt 1 chậu hoa\n{"intent":"order","address":"69 Hàng Xanh"}',
                        conversationId: "c1",
                    },
                },
            ],
        },
        {
            name: "tags with the note alone",
            params: { toAgentKey: "care" },
            input: { text: "Khách cần hỗ trợ sau mua", conversationId: null, context: null },
            output: { toAgentKey: "care", tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "care",
                        text: "Khách cần hỗ trợ sau mua",
                    },
                },
            ],
        },
    ],
})
