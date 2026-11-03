import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { tagTextOf } from "./handoff.policy"
import type { HandoffInput, HandoffOutput, HandoffParams } from "./handoff.types"

const TARGET_MAX = 120
const TEXT_MAX = 2000
const CONTEXT_KEYS_MAX = 40
const CONTEXT_JSON_MAX = 8000

/** Plain data only: strings, numbers, booleans, null, arrays and objects of them. */
const contextValue: NodeSchema<JsonValue> = z.json()

const params: NodeSchema<HandoffParams> = z.object({ toModuleKey: z.string().min(1).max(TARGET_MAX) })

const input: NodeSchema<HandoffInput> = z.object({
    text: z.string().min(1).max(TEXT_MAX),
    conversationId: z.string().min(1).max(TARGET_MAX).nullable(),
    context: z
        .record(z.string().max(TARGET_MAX), contextValue)
        .refine(
            (entries) =>
                Object.keys(entries).length <= CONTEXT_KEYS_MAX && JSON.stringify(entries).length <= CONTEXT_JSON_MAX,
        )
        .nullable(),
})

const output: NodeSchema<HandoffOutput> = z.object({
    toModuleKey: z.string(),
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
        const tag = await context.effect(
            "agent.tag",
            {
                toModuleKey: context.params.toModuleKey,
                text: tagTextOf(given),
                ...(given.conversationId === null ? {} : { conversationId: given.conversationId }),
                ...(context.turn.subject === null ? {} : { subject: context.turn.subject }),
            },
            { dedupeKey: `agent-tag:${context.turn.turnId}:${context.params.toModuleKey}` },
        )
        return { toModuleKey: context.params.toModuleKey, tag }
    },
    examples: [
        {
            name: "tags the target agent with the note and the context",
            params: { toModuleKey: "sales" },
            input: {
                text: "Khách muốn đặt 1 chậu hoa",
                conversationId: "c1",
                context: { intent: "order", address: "69 Hàng Xanh" },
            },
            output: { toModuleKey: "sales", tag: { kind: "agent.tag", id: "agent.tag-1" } },
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
            params: { toModuleKey: "care" },
            input: { text: "Khách cần hỗ trợ sau mua", conversationId: null, context: null },
            output: { toModuleKey: "care", tag: { kind: "agent.tag", id: "agent.tag-1" } },
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
