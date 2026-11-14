import type { ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { formBlock } from "../blocks/form.block"

/** The record a sample form edits. */
export interface FormFixtureRecord {
    /** The key of the record. */
    readonly id: string
    /** The text field. */
    readonly title: string
    /** The number field. */
    readonly points: number
    /** The money field. */
    readonly price: number
    /** The switch. */
    readonly isActive: boolean
    /** The choice field. */
    readonly tier: string
    /** The date field, as year-month-day. */
    readonly until: string
    /** The multi-line field. */
    readonly note: string
}

/** Every status the record read of a form can be in; an empty or unbound read is a blank form, never a loading one. */
export interface FormFixtureSlots {
    /** The record to edit. */
    readonly ready: DataSlot<FormFixtureRecord>
    /** No record: a blank form. */
    readonly empty: DataSlot<FormFixtureRecord>
    /** The read failed. */
    readonly error: DataSlot<FormFixtureRecord>
    /** The record is arriving: the fields draw as skeletons. */
    readonly loading: DataSlot<FormFixtureRecord>
    /** The viewer may not see the record. */
    readonly forbidden: DataSlot<FormFixtureRecord>
}

/** What running the submit of the sample form may answer. */
export interface FormFixtureOutcomes {
    /** The values were saved. */
    readonly saved: ActionOutcome
    /** The server refused a field, which shows on that field. */
    readonly invalid: ActionOutcome
    /** The record changed under the person. */
    readonly conflict: ActionOutcome
    /** The run failed. */
    readonly failed: ActionOutcome
}

/** The props of a form with a field of every kind. */
export const formFixtureProps: z.infer<(typeof formBlock)["props"]> = {
    label: { vi: "Phan thuong", en: "Reward" },
    submitLabel: { vi: "Luu", en: "Save" },
    successNotice: { vi: "Da luu", en: "Saved" },
    currency: "VND",
    fields: [
        { name: "title", label: { vi: "Ten", en: "Name" }, kind: "text", required: true, max: 80 },
        { name: "points", label: { vi: "Diem", en: "Points" }, kind: "number", required: true, max: 100_000 },
        { name: "price", label: { vi: "Gia tri", en: "Value" }, kind: "money" },
        {
            name: "tier",
            label: { vi: "Hang", en: "Tier" },
            kind: "choice",
            required: true,
            options: [
                { value: "silver", label: { vi: "Bac", en: "Silver" } },
                { value: "gold", label: { vi: "Vang", en: "Gold" } },
            ],
        },
        {
            name: "until",
            label: { vi: "Het han", en: "Expires" },
            kind: "date",
            hint: { vi: "Nam-thang-ngay", en: "Year-month-day" },
        },
        { name: "isActive", label: { vi: "Dang ap dung", en: "Active" }, kind: "switch" },
        { name: "note", label: { vi: "Ghi chu", en: "Note" }, kind: "textarea", max: 500 },
    ],
}

/** The record the sample form starts from when it edits. */
export const FORM_FIXTURE_RECORD: FormFixtureRecord = {
    id: "reward-1",
    title: "Tang mot ly ca phe",
    points: 120,
    price: 45_000,
    isActive: true,
    tier: "silver",
    until: "2026-12-31",
    note: "",
}

/** The sample form in every status of its record. */
export const formFixtures: FormFixtureSlots = {
    ready: { items: FORM_FIXTURE_RECORD },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The answers the submit of the sample form may give. */
export const formOutcomes: FormFixtureOutcomes = {
    saved: { ok: true },
    invalid: { ok: false, reason: "invalid", fields: { title: { vi: "Ten nay da co", en: "This name is taken" } } },
    conflict: { ok: false, reason: "conflict", message: { vi: "Da co nguoi sua", en: "Someone else changed it" } },
    failed: { ok: false, reason: "failed", message: { key: "slotError" } },
}
