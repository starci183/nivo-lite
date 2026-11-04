import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { tagPayloadOf } from "./handoff.policy"
import type { HandoffInput, HandoffOutput, HandoffParams, HandoffParamsIn } from "./handoff.types"
import { MAX_ID } from "../../bounds"
import { boundedJson } from "../../json.schema"
import { bilingualOf, sampleOf } from "../../messages/catalog"

const TARGET_MAX = 120
const TEXT_MAX = 2000
const CONTEXT_KEYS_MAX = 40
const CONTEXT_JSON_MAX = 8000

/** Plain data only: strings, numbers, booleans, null, arrays and objects of them. */
const contextValue = boundedJson

const params: NodeSchema<HandoffParams, HandoffParamsIn> = z.object({
    toModuleKey: z.string().min(1).max(TARGET_MAX),
    visibility: z.enum(["chat", "redirect"]).default("chat"),
})

const input: NodeSchema<HandoffInput> = z.object({
    text: z.string().min(1).max(TEXT_MAX),
    leadId: z.string().min(1).max(TARGET_MAX).nullable(),
    channel: z.string().min(1).max(TARGET_MAX).nullable(),
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
    toModuleKey: z.string().max(MAX_ID),
    tag: z.object({ kind: z.string().max(MAX_ID), id: z.string().max(MAX_ID) }),
})

/** `core.handoff`: tags another agent of the workspace with a note and the context of the turn. The agent to tag is a param of the graph. */
export const coreHandoffNode: NodeDefinition<
    NodeSchema<HandoffInput>,
    NodeSchema<HandoffOutput>,
    NodeSchema<HandoffParams, HandoffParamsIn>
> = defineNode({
    id: "core.handoff",
    role: "output",
    title: bilingualOf("nodeCoreHandoffTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["agent.tag"],
    run: async (given, context) => {
        const tag = await context.effect("agent.tag", tagPayloadOf(context.params, given, context.turn.subject), {
            dedupeKey: `agent-tag:${context.turn.turnId}:${context.params.toModuleKey}`,
        })
        return { toModuleKey: context.params.toModuleKey, tag }
    },
    examples: [
        {
            name: "tags the target agent with the note and the context",
            params: { toModuleKey: "sales" },
            input: {
                text: sampleOf("sampleKhachMuonDat1ChauHoa"),
                leadId: "l1",
                channel: "zalo",
                conversationId: "c1",
                context: {
                    intent: "order",
                    order: {
                        items: [{ name: sampleOf("sampleChauHoa"), quantity: 1 }],
                        address: sampleOf("sample69HangXanh"),
                    },
                },
            },
            output: { toModuleKey: "sales", tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "sales",
                        visibility: "chat",
                        text: sampleOf("sampleKhachMuonDat1ChauHoa"),
                        context: {
                            intent: "order",
                            order: {
                                items: [{ name: sampleOf("sampleChauHoa"), quantity: 1 }],
                                address: sampleOf("sample69HangXanh"),
                            },
                        },
                        leadId: "l1",
                        channel: "zalo",
                        conversationId: "c1",
                    },
                },
            ],
        },
        {
            name: "a redirect is a silent direct hand-off with the note alone",
            params: { toModuleKey: "care", visibility: "redirect" },
            input: {
                text: sampleOf("sampleKhachCanHoTroSauMua"),
                leadId: null,
                channel: null,
                conversationId: null,
                context: null,
            },
            output: { toModuleKey: "care", tag: { kind: "agent.tag", id: "agent.tag-1" } },
            effects: [
                {
                    kind: "agent.tag",
                    payload: {
                        toModuleKey: "care",
                        visibility: "redirect",
                        text: sampleOf("sampleKhachCanHoTroSauMua"),
                    },
                },
            ],
        },
    ],
})
