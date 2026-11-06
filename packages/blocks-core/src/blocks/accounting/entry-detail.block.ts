import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "../param-name"
import type { ParamNameSchema } from "../param-name"
import type { OptionalAction, RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{
    label: TextSchema
    idle: TextSchema
    kind: TextSchema
    closeParam: ParamNameSchema
}> = z.object({
    label: specText,
    idle: specText,
    kind: specText,
    closeParam: paramName,
})

/** The slots of the entry detail: the entry it shows and the correction it may add to it. */
type Slots = {
    readonly record: RequiredRead<"record">
    readonly adjust: OptionalAction
}
const slots: Slots = {
    record: { kind: "read", shape: "record", required: true },
    adjust: { kind: "action", required: false },
}

/**
 * One entry of the books: its note and kind, where it came from as a timeline of order, invoice and payment (a stage that does not
 * exist yet is drawn waiting), and the correction form pinned at the bottom. A correction is added beside the record; the original is
 * never changed. `closeParam` is cleared by the close control.
 */
export const accountingEntryDetailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "accounting.entry-detail",
    title: { key: "blockAccountingEntryDetail" },
    props,
    slots,
    children: false,
    params: ["closeParam"],
})
