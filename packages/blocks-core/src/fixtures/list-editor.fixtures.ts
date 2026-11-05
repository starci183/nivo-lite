import type { ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { listEditorBlock } from "../blocks/list-editor.block"

/** One tier of the sample ladder. */
export interface TierFixtureRow {
    /** The name of the tier. */
    readonly name: string
    /** The points a member needs to reach the tier. */
    readonly minPoints: number
    /** The money a point is worth in the tier. */
    readonly pointValue: number
    /** The kind of reward the tier gives. */
    readonly reward: string
    /** Whether the tier is offered now. */
    readonly isActive: boolean
}

/** The record a sample list editor edits: a ladder of tiers. */
export interface ListEditorFixtureRecord {
    /** The key of the record. */
    readonly id: string
    /** The tiers of the ladder, lowest first. */
    readonly tiers: ReadonlyArray<TierFixtureRow>
}

/** Every status the record read of a list editor can be in; an empty or unbound read is an editor with no rows, never a loading one. */
export interface ListEditorFixtureSlots {
    /** The record holds a ladder. */
    readonly ready: DataSlot<ListEditorFixtureRecord>
    /** The record holds a ladder with no tier yet. */
    readonly noRows: DataSlot<ListEditorFixtureRecord>
    /** No record: an editor with no rows. */
    readonly empty: DataSlot<ListEditorFixtureRecord>
    /** The read failed. */
    readonly error: DataSlot<ListEditorFixtureRecord>
    /** The record is arriving: the fields draw as skeletons. */
    readonly loading: DataSlot<ListEditorFixtureRecord>
    /** The viewer may not see the record. */
    readonly forbidden: DataSlot<ListEditorFixtureRecord>
}

/** What running the save of the sample editor may answer. */
export interface ListEditorFixtureOutcomes {
    /** The list was saved. */
    readonly saved: ActionOutcome
    /** The server refused a field of a row, which shows on that field. */
    readonly invalid: ActionOutcome
    /** The record changed under the person. */
    readonly conflict: ActionOutcome
    /** The run failed. */
    readonly failed: ActionOutcome
}

/** The props of a ladder editor: a text, two numbers, a choice and a switch in every row, rows that move. */
export const listEditorFixtureProps: z.infer<(typeof listEditorBlock)["props"]> = {
    label: { vi: "Cac hang thanh vien", en: "Member tiers" },
    listPath: "tiers",
    fields: [
        { name: "name", label: { vi: "Ten hang", en: "Tier name" }, kind: "text", required: true, max: 40 },
        { name: "minPoints", label: { vi: "Diem toi thieu", en: "Points needed" }, kind: "number", required: true },
        { name: "pointValue", label: { vi: "Gia tri mot diem", en: "Value of a point" }, kind: "money" },
        {
            name: "reward",
            label: { vi: "Phan thuong", en: "Reward" },
            kind: "choice",
            options: [
                { value: "drink", label: { vi: "Do uong", en: "Drink" } },
                { value: "discount", label: { vi: "Giam gia", en: "Discount" } },
            ],
        },
        { name: "isActive", label: { vi: "Dang ap dung", en: "Active" }, kind: "switch" },
    ],
    minRows: 1,
    maxRows: 6,
    isReorderable: true,
    addLabel: { vi: "Them hang", en: "Add a tier" },
    removeLabel: { vi: "Xoa", en: "Remove" },
    moveUpLabel: { vi: "Len", en: "Up" },
    moveDownLabel: { vi: "Xuong", en: "Down" },
    emptyRows: { vi: "Chua co hang nao", en: "No tiers yet" },
    submitLabel: { vi: "Luu", en: "Save" },
    successNotice: { vi: "Da luu", en: "Saved" },
    currency: "VND",
}

/** The tiers of the sample ladder. */
export const TIER_FIXTURE_ROWS: ReadonlyArray<TierFixtureRow> = [
    { name: "Dong", minPoints: 0, pointValue: 100, reward: "drink", isActive: true },
    { name: "Bac", minPoints: 500, pointValue: 150, reward: "drink", isActive: true },
    { name: "Vang", minPoints: 2000, pointValue: 250, reward: "discount", isActive: false },
]

/** The record the sample editor starts from. */
export const LIST_EDITOR_FIXTURE_RECORD: ListEditorFixtureRecord = { id: "ladder-1", tiers: TIER_FIXTURE_ROWS }

/** The sample editor in every status of its record. */
export const listEditorFixtures: ListEditorFixtureSlots = {
    ready: { items: LIST_EDITOR_FIXTURE_RECORD },
    noRows: { items: { id: "ladder-1", tiers: [] } },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The answers the save of the sample editor may give; the refused field is the minimum of the second row. */
export const listEditorOutcomes: ListEditorFixtureOutcomes = {
    saved: { ok: true },
    invalid: {
        ok: false,
        reason: "invalid",
        fields: { "1.minPoints": { vi: "Phai lon hon hang truoc", en: "Must be above the tier before" } },
    },
    conflict: { ok: false, reason: "conflict", message: { vi: "Da co nguoi sua", en: "Someone else changed it" } },
    failed: { ok: false, reason: "failed", message: { key: "slotError" } },
}
