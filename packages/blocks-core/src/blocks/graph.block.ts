import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "./param-name"
import type { RequiredRead, TextSchema } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    empty: z.ZodOptional<TextSchema>
    selectParam: z.ZodOptional<z.ZodString>
    runParam: z.ZodOptional<z.ZodString>
}> = z.object({
    label: specText,
    empty: specText.optional(),
    selectParam: paramName.optional(),
    runParam: paramName.optional(),
})

/** A read slot a spec may leave unbound. */
interface OptionalRecordRead {
    /** Marks the slot as one a spec binds to a read. */
    readonly kind: "read"
    /** The bound read yields one record. */
    readonly shape: "record"
    /** A spec may leave the slot unbound; the graph then shows no run path. */
    readonly required: false
}

/** The slots of the graph block: the graph, and the run whose path it may show. */
type Slots = {
    readonly graph: RequiredRead<"record">
    readonly path: OptionalRecordRead
}
const slots: Slots = {
    graph: { kind: "read", shape: "record", required: true },
    path: { kind: "read", shape: "record", required: false },
}

/**
 * A graph drawn left to right: its trigger, nodes, edges with their conditions, wait nodes and the state of each node. Choosing a
 * node writes its id to the `selectParam`, so a detail beside the graph shows that node. While the `runParam` names a run, the
 * `path` read (bound with the run's id) says which nodes the run reached: those draw in the run's states, the rest dim.
 */
export const graphBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.graph",
    title: { key: "blockGraph" },
    props,
    slots,
    children: false,
    params: ["selectParam", "runParam"],
})
