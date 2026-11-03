import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema, RequiredRead } from "./schema-types"

const props: z.ZodObject<{ label: TextSchema }> = z.object({ label: specText })
const slots: { readonly region: RequiredRead<"record"> } = { region: { kind: "read", shape: "record", required: true } }

/** The items that wait for a person, each linking to its subject; the card is not drawn while nothing waits. */
export const waitingBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.waiting",
    title: { key: "blockWaiting" },
    props,
    slots,
    children: false,
})
