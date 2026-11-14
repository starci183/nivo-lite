import type { ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { decisionQueueBlock } from "../blocks/decision-queue.block"
import type { DecisionQueueView, DecisionRowView } from "../views/views.types"

/** Every status the queue read can be in, for the stories and the specs. */
export interface DecisionQueueFixtureSlots {
    /** Two decisions wait, one with a draft the person may edit. */
    readonly ready: DataSlot<DecisionQueueView>
    /** Nothing waits. */
    readonly empty: DataSlot<DecisionQueueView>
    /** The read failed. */
    readonly error: DataSlot<DecisionQueueView>
    /** The first read is in flight. */
    readonly loading: DataSlot<DecisionQueueView>
    /** The viewer may not see the queue. */
    readonly forbidden: DataSlot<DecisionQueueView>
}

/** What running the command of the sample queue may answer. */
export interface DecisionQueueFixtureOutcomes {
    /** The command was run, or the edit saved. */
    readonly done: ActionOutcome
    /** The server refused a field of the edit, which shows on that field. */
    readonly invalid: ActionOutcome
    /** The proposal changed under the person. */
    readonly conflict: ActionOutcome
}

/** The props of a queue with its commands named by the spec and an edit form of two fields. */
export const decisionQueueFixtureProps: z.infer<(typeof decisionQueueBlock)["props"]> = {
    surface: "section",
    label: { vi: "Cho duyet", en: "To approve" },
    emptyTitle: { vi: "Khong co gi cho duyet", en: "Nothing to approve" },
    emptyBody: { vi: "Moi viec da xong", en: "Everything is done" },
    seeWhy: { vi: "Xem ly do", en: "See why" },
    moreMenu: { vi: "Them", en: "More" },
    currency: "VND",
    commands: [
        { id: "approve", label: { vi: "Duyet", en: "Approve" } },
        { id: "reject", label: { vi: "Tu choi", en: "Reject" }, intent: "danger" },
        { id: "later", label: { vi: "De sau", en: "Later" }, intent: "neutral" },
    ],
    edit: {
        label: { vi: "Sua", en: "Edit" },
        submitLabel: { vi: "Luu thay doi", en: "Save changes" },
        cancelLabel: { vi: "Huy", en: "Cancel" },
        fields: [
            { name: "amount", label: { vi: "So tien", en: "Amount" }, kind: "money", required: true },
            { name: "note", label: { vi: "Ghi chu", en: "Note" }, kind: "text", max: 120 },
        ],
    },
}

const decision = (id: string, overrides: Partial<DecisionRowView>): DecisionRowView => ({
    id,
    title: "Hoan tien don 1042",
    description: "Khach Mai",
    badges: [{ label: "Moi", tone: "neutral" }],
    reason: "Vuot han muc tu dong",
    amount: "450.000 d",
    proposal: "Hoan 450.000 d cho khach",
    trace: null,
    expiry: null,
    primary: { id: "approve", label: "Approve" },
    edit: { id: "change", label: "Change" },
    menu: [{ id: "reject", label: "Reject" }],
    waitingFor: null,
    ...overrides,
})

/** The sample queue: a decision with a draft to edit, and one the viewer may only watch. */
export const DECISION_QUEUE_FIXTURE: DecisionQueueView = {
    count: "2",
    more: null,
    rows: [
        decision("d1", { leading: "Sales AI", draft: { amount: 450_000, note: "Khach doi y" } }),
        decision("d2", { title: "Giam gia don 1050", primary: null, edit: null, menu: [], waitingFor: "Chu quan" }),
    ],
}

/** The sample queue in every status. */
export const decisionQueueFixtures: DecisionQueueFixtureSlots = {
    ready: { items: DECISION_QUEUE_FIXTURE },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The answers the action of the sample queue may give. */
export const decisionQueueOutcomes: DecisionQueueFixtureOutcomes = {
    done: { ok: true },
    invalid: { ok: false, reason: "invalid", fields: { amount: { vi: "Qua han muc", en: "Over the limit" } } },
    conflict: { ok: false, reason: "conflict", message: { vi: "De xuat da doi", en: "The proposal changed" } },
}
