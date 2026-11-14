import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { boardBlock } from "../blocks/board.block"

/** One record of the sample list a board is drawn from. */
export interface BoardFixtureRecord {
    /** The key of the record. */
    readonly id: string
    /** The name drawn on the card. */
    readonly name: string
    /** The line under the name. */
    readonly note: string
    /** The column the card is in. */
    readonly stage: string
}

/** Every status the cards read of a board can be in, for the stories and the specs. */
export interface BoardFixtureSlots {
    /** The list has cards in every column. */
    readonly ready: DataSlot<ReadonlyArray<BoardFixtureRecord>>
    /** The list settled with no cards. */
    readonly empty: DataSlot<ReadonlyArray<BoardFixtureRecord>>
    /** The read failed. */
    readonly error: DataSlot<ReadonlyArray<BoardFixtureRecord>>
    /** The first read is in flight. */
    readonly loading: DataSlot<ReadonlyArray<BoardFixtureRecord>>
    /** The viewer may not see the list. */
    readonly forbidden: DataSlot<ReadonlyArray<BoardFixtureRecord>>
}

/** The props of a board over the sample list: three columns of a stage field. */
export const boardFixtureProps: z.infer<(typeof boardBlock)["props"]> = {
    label: { vi: "Tien trinh mau", en: "Sample pipeline" },
    emptyColumn: { vi: "Chua co the nao", en: "No cards yet" },
    idPath: "id",
    titlePath: "name",
    descriptionPath: "note",
    groupBy: "stage",
    columns: [
        { value: "new", label: { vi: "Moi", en: "New" } },
        { value: "offer", label: { vi: "De xuat", en: "Offer" } },
        { value: "won", label: { vi: "Da chot", en: "Won" } },
    ],
}

/** The records of the sample list. */
export const BOARD_FIXTURE_RECORDS: ReadonlyArray<BoardFixtureRecord> = [
    { id: "c1", name: "Chi Lan", note: "Hoi gia goi 3 thang", stage: "new" },
    { id: "c2", name: "Anh Bao", note: "Can bao gia", stage: "offer" },
    { id: "c3", name: "Chi Ngoc", note: "Da thanh toan", stage: "won" },
]

/** The sample list in every status. */
export const boardFixtures: BoardFixtureSlots = {
    ready: { items: BOARD_FIXTURE_RECORDS },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
