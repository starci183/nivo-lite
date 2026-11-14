import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { detailBlock } from "../blocks/detail.block"

/** The person a sample record names. */
export interface DetailFixtureOwner {
    /** The name drawn in the third fact of the second group. */
    readonly name: string
}

/** The record a sample detail shows. */
export interface DetailFixtureRecord {
    /** The key of the record. */
    readonly id: string
    /** The name drawn as text. */
    readonly name: string
    /** The status drawn as a badge. */
    readonly status: string
    /** The total drawn as money. */
    readonly total: number
    /** The moment drawn as a date and time. */
    readonly createdAt: string
    /** The person in charge. */
    readonly owner: DetailFixtureOwner
}

/** Every status the record read of a detail can be in; an empty read is the idle notice. */
export interface DetailFixtureSlots {
    /** The record to show. */
    readonly ready: DataSlot<DetailFixtureRecord>
    /** No record is chosen, or it was not found: the idle notice. */
    readonly empty: DataSlot<DetailFixtureRecord>
    /** The read failed. */
    readonly error: DataSlot<DetailFixtureRecord>
    /** The record is arriving. */
    readonly loading: DataSlot<DetailFixtureRecord>
    /** The viewer may not see the record. */
    readonly forbidden: DataSlot<DetailFixtureRecord>
}

/** The props of a detail with a first group and a titled one. */
export const detailFixtureProps: z.infer<(typeof detailBlock)["props"]> = {
    label: { vi: "Chi tiet", en: "Detail" },
    idle: { vi: "Chon mot dong de xem chi tiet", en: "Choose a row to see its detail" },
    currency: "VND",
    items: [
        { term: { vi: "Ten", en: "Name" }, path: "name" },
        { term: { vi: "Trang thai", en: "Status" }, path: "status", format: "badge" },
    ],
    sections: [
        {
            title: { vi: "Thanh toan", en: "Payment" },
            items: [
                { term: { vi: "Tong", en: "Total" }, path: "total", format: "money" },
                { term: { vi: "Tao luc", en: "Created" }, path: "createdAt", format: "dateTime" },
                { term: { vi: "Phu trach", en: "Owner" }, path: "owner.name" },
            ],
        },
    ],
}

/** The record of the sample detail. */
export const DETAIL_FIXTURE_RECORD: DetailFixtureRecord = {
    id: "d1",
    name: "Don 1042",
    status: "open",
    total: 3_450_000,
    createdAt: "2026-11-05T08:30:00Z",
    owner: { name: "Lan" },
}

/** The sample detail in every status of its record. */
export const detailFixtures: DetailFixtureSlots = {
    ready: { items: DETAIL_FIXTURE_RECORD },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
