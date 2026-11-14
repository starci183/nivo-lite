import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { CONSULT_STAGES } from "../entities/lead.entity"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { refusalSchema } from "./care.steps"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import { SALES_LEAD_ENTITY } from "../../../shared/entities/sales-entity-names"

/** What the stage step is given: the customer. */
export interface ConsultStageInput {
    /** The customer whose consult stage moves; null only when the graph is wired wrongly (the step then cannot move anything). */
    readonly leadId: string | null
}

/** What the stage step did. */
export interface ConsultStageOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** True when the stage was written. */
    readonly moved: boolean
    /** The tool's refusal when it was not, else null. */
    readonly refusal: string | null
}

/** What the graph sets: the consult stage to move to. */
export interface ConsultStageParams {
    /** The consult stage (`after_sale` after the thank-you). */
    readonly stage: string
}

const params: NodeSchema<ConsultStageParams, { stage?: string | undefined }> = z.object({
    stage: z.enum(CONSULT_STAGES).default("after_sale"),
})

const input: NodeSchema<ConsultStageInput> = z.object({ leadId: z.string().max(MAX_ID).min(1).nullable() })

const output: NodeSchema<ConsultStageOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The customer, as given."),
    moved: z.boolean().describe("True when the consult stage was written."),
    refusal: refusalSchema,
})

/** The record update that moves one customer's consult stage. */
const STAGE_OF = (leadId: string, stage: string) => ({ type: SALES_LEAD_ENTITY, id: leadId, patch: { consultStage: stage } })

/**
 * `sales.consult-stage` (Chuyen giai doan tu van): moves the customer's CONSULT stage (`discover` ... `after_sale`) to the stage the graph
 * sets, through `nivo.tool.record.update` on the declared `blocks-core.sales.lead` record (`consultStage`). Split from `sales.after-sale` (the old
 * agent did it after sending). Not the pipeline stage (`stage`, `new` ... `lost`).
 */
export const salesConsultStageNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: "sales.consult-stage",
    title: { key: "nodeSalesConsultStageTitle" },
    description: { vi: "Chuy\u1ec3n kh\u00e1ch sang giai \u0111o\u1ea1n t\u01b0 v\u1ea5n ti\u1ebfp theo trong h\u1ed3 s\u01a1 b\u00e1n h\u00e0ng.", en: "Moves the customer to the next consult stage in the sales file." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    params,
    run: async (given, context) => {
        const leadId = given.leadId
        if (leadId === null) return context.fail({ kind: "cannot", why: "the stage step was reached with no customer" })
        const written = await context.tools.call(TOOL.recordUpdate, STAGE_OF(leadId, context.params.stage))
        return written.ok ? { leadId, moved: true, refusal: null } : { leadId, moved: false, refusal: written.declined === true ? "declined" : written.refusal }
    },
    examples: [
        {
            name: "after the thank-you the customer moves to after-sale",
            params: { stage: "after_sale" },
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: STAGE_OF("l1", "after_sale"),
                    answer: answered({
                        record: {
                            id: "l1",
                            version: "2",
                            createdAt: "2026-11-01T00:00:00.000Z",
                            updatedAt: "2026-11-02T00:00:00.000Z",
                            values: { consultStage: "after_sale" },
                        },
                    }),
                },
            ],
            output: { leadId: "l1", moved: true, refusal: null },
        },
        {
            name: "a person declined the write on its card: the step says so and the graph goes on",
            params: {},
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: STAGE_OF("l1", "after_sale"),
                    answer: refused("declined"),
                },
            ],
            output: { leadId: "l1", moved: false, refusal: "declined" },
        },
        {
            name: "reached with no customer (a wiring fault): the step cannot move anything and says so",
            params: {},
            input: { leadId: null },
            tools: [],
            failure: { kind: "cannot", why: "the stage step was reached with no customer" },
        },
    ],
})
