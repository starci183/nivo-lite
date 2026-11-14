import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { tableBlock } from "../blocks/table.block"

/** One record of the sample list a table is drawn from. */
export interface TableFixtureRecord {
    /** The key of the record. */
    readonly id: string
    /** The name drawn in the first column. */
    readonly name: string
    /** The amount drawn as money. */
    readonly amount: number
    /** The status drawn as a badge. */
    readonly state: string
    /** The day drawn as a date. */
    readonly issuedAt: string
}

/** Every status the rows read of a table can be in, for the stories and the specs. */
export interface TableFixtureSlots {
    /** The list has rows. */
    readonly ready: DataSlot<ReadonlyArray<TableFixtureRecord>>
    /** The list settled with no rows. */
    readonly empty: DataSlot<ReadonlyArray<TableFixtureRecord>>
    /** The read failed. */
    readonly error: DataSlot<ReadonlyArray<TableFixtureRecord>>
    /** The first read is in flight. */
    readonly loading: DataSlot<ReadonlyArray<TableFixtureRecord>>
    /** The viewer may not see the list. */
    readonly forbidden: DataSlot<ReadonlyArray<TableFixtureRecord>>
}

/** The props of a table over the sample list: a text column, money, a badge and a day. */
export const tableFixtureProps: z.infer<(typeof tableBlock)["props"]> = {
    label: { vi: "Danh sach mau", en: "Sample list" },
    empty: { vi: "Chua co dong nao", en: "No rows yet" },
    idPath: "id",
    currency: "VND",
    columns: [
        { term: { vi: "Ten", en: "Name" }, path: "name" },
        { term: { vi: "So tien", en: "Amount" }, path: "amount", format: "money" },
        { term: { vi: "Trang thai", en: "Status" }, path: "state", format: "badge", priority: "low" },
        { term: { vi: "Ngay", en: "Date" }, path: "issuedAt", format: "date", priority: "low" },
    ],
}

/** The records of the sample list. */
export const TABLE_FIXTURE_RECORDS: ReadonlyArray<TableFixtureRecord> = [
    { id: "r1", name: "Phieu 001", amount: 1_250_000, state: "paid", issuedAt: "2026-11-01" },
    { id: "r2", name: "Phieu 002", amount: 480_000, state: "open", issuedAt: "2026-11-03" },
    { id: "r3", name: "Phieu 003", amount: 2_000_000, state: "open", issuedAt: "2026-11-05" },
]

/** The sample list in every status. */
export const tableFixtures: TableFixtureSlots = {
    ready: { items: TABLE_FIXTURE_RECORDS },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
