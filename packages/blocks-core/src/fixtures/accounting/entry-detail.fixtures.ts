import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { accountingEntryDetailBlock } from "../../blocks/accounting/entry-detail.block"
import type { EntryRecord } from "../../rules/accounting/entry-stages"

/** The props of the entry detail as the Accounting spec sets them. */
export const entryDetailFixtureProps: z.infer<(typeof accountingEntryDetailBlock)["props"]> = {
    label: { vi: "Chi ti\u1ebft ch\u1ee9ng t\u1eeb", en: "Entry detail" },
    idle: {
        vi: "Ch\u1ecdn m\u1ed9t ch\u1ee9ng t\u1eeb \u0111\u1ec3 xem chi ti\u1ebft.",
        en: "Choose an entry to see its detail.",
    },
    kind: { vi: "Ch\u1ee9ng t\u1eeb", en: "Entry" },
    closeParam: "selected",
}

/** H-0140 of the canvas: its order and invoice exist, the payment does not yet. */
export const ENTRY_WAITING: EntryRecord = {
    id: "e2",
    note: "H\u0110-0140 \u00b7 C\u00f4ng ty T\u00e2n Ph\u00e1t",
    sourceEntity: "accounting.invoice",
    sourceId: "i1",
    lineage: [
        {
            id: "o1",
            kind: "order",
            title: "#1087",
            detail: null,
            at: "2026-10-28T03:00:00.000Z",
            status: "confirmed",
            amount: 8_400_000,
        },
        {
            id: "i1",
            kind: "invoice",
            title: "H\u0110-0140",
            detail: "K\u1ebf to\u00e1n t\u1ef1 xu\u1ea5t",
            at: "2026-10-29T03:00:00.000Z",
            status: "issued",
            amount: 8_400_000,
        },
    ],
}

/** An entry whose payment came in too. */
export const ENTRY_SETTLED: EntryRecord = {
    ...ENTRY_WAITING,
    lineage: [
        ...ENTRY_WAITING.lineage,
        {
            id: "t1",
            kind: "payment",
            title: "C\u00f4ng ty T\u00e2n Ph\u00e1t",
            detail: "CK H\u0110-0140",
            at: "2026-11-04T02:12:00.000Z",
            status: "matched",
            amount: 8_400_000,
        },
    ],
}

/** The entry read in every status. */
export const entryDetailFixtures: Readonly<
    Record<"ready" | "waiting" | "empty" | "error" | "loading" | "forbidden", DataSlot<EntryRecord>>
> = {
    ready: { items: ENTRY_SETTLED },
    waiting: { items: ENTRY_WAITING },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
