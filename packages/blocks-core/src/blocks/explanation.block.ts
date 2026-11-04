import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema, ExplanationSlots } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    listLabel: TextSchema
    waitingLabel: TextSchema
    doneLabel: TextSchema
    openLabel: TextSchema
    closeLabel: TextSchema
    pathLabel: TextSchema
    factsLabel: TextSchema
    sourcesLabel: TextSchema
    approverLabel: TextSchema
    timeLabel: TextSchema
    openOnMap: TextSchema
    missingTitle: TextSchema
    missingBody: TextSchema
}> = z.object({
    label: specText,
    listLabel: specText,
    waitingLabel: specText,
    doneLabel: specText,
    openLabel: specText,
    closeLabel: specText,
    pathLabel: specText,
    factsLabel: specText,
    sourcesLabel: specText,
    approverLabel: specText,
    timeLabel: specText,
    openOnMap: specText,
    missingTitle: specText,
    missingBody: specText,
})
const slots: ExplanationSlots = {
    why: { kind: "read", shape: "record", required: true },
    waiting: { kind: "read", shape: "record", required: true },
    done: { kind: "read", shape: "record", required: true },
    close: { kind: "action", required: true },
}

/** The recorded explanation of one work item beside the lists of what waits and what was done; its close action clears the open item. */
export const explanationBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.explanation",
    title: { key: "blockExplanation" },
    props,
    slots,
    children: false,
})
