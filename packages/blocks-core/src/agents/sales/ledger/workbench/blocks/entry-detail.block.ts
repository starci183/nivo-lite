import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName, type ParamNameSchema } from "../../../../../shared/blocks/param-name"
import type { OptionalAction, RequiredRead, TextSchema } from "../../../../../shared/blocks/schema-types"

const props: z.ZodObject<{
    label: TextSchema
    idle: TextSchema
    kind: TextSchema
    closeParam: ParamNameSchema
    paneParam: ParamNameSchema
}> = z.object({
    label: specText,
    idle: specText,
    kind: specText,
    closeParam: paramName,
    paneParam: paramName,
})

/** The slots of the entry detail: the entry it shows and the correction it may add to it. */
type Slots = {
    readonly record: RequiredRead<"record">
    readonly adjust: OptionalAction
    readonly repost: OptionalAction
}
const slots: Slots = {
    record: { kind: "read", shape: "record", required: true },
    adjust: { kind: "action", required: false },
    repost: { kind: "action", required: false },
}

/**
 * One entry of the books: its note and kind, where it came from as a timeline of order, invoice and payment (a stage that does not
 * exist yet is drawn waiting), and the correction form pinned at the bottom. A correction is added beside the record; the original is
 * never changed. A paid payment's entry may also ask for its ledger line again (`repost`, offered when the read says so). The close control clears `closeParam` and takes the aside back to the queue (`paneParam` takes `list`).
 */
export const accountingEntryDetailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.entry-detail",
    title: { key: "blockAccountingEntryDetail" },
    props,
    slots,
    children: false,
    params: ["closeParam", "paneParam"],
})
