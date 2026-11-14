"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { keyGroupsOf, pickGroupOf, type FactKey, type FactPickWords, type PickGrouping } from "@/modules/brain"
import type { FactPickGroupView, PickConfirmView, PickSelectionBarView } from "@/modules/types"
import { useFactBatch, type FactOperation } from "./useFactBatch"
import { useFailureToast } from "./useFailureToast"

/** What the ticked rows are read against. */
export interface FactPickInput {
    readonly keys: ReadonlyArray<FactKey>
    readonly by: PickGrouping
    readonly topicOf: (sourceId: string) => string | undefined
    readonly words: FactPickWords
    readonly canWrite: boolean
}

/** What the ticked rows give their table. */
export interface FactPick {
    readonly groups: ReadonlyArray<FactPickGroupView>
    readonly bar: PickSelectionBarView
    readonly confirm: PickConfirmView | null
    readonly on: {
        readonly toggleRow: (key: string) => void
        readonly toggleGroup: (groupId: string) => void
        readonly toggleOpen: (groupId: string) => void
        readonly clear: () => void
        readonly askApprove: () => void
        readonly askReject: () => void
        readonly cancel: () => void
        readonly confirm: () => void
    }
}

/** The decision that approves one fresh key: a stop applies, merged values choose the kept one (the others are rejected), else apply. */
const approveOf = (one: FactKey): FactOperation => {
    if (one.lead.proposalKind === "retire") return { kind: "decide", request: { id: one.lead.id, action: "apply" } }
    const action = one.proposals.length > 1 ? "choose" : "apply"
    return { kind: "decide", request: { id: one.lead.id, action } }
}

/** The decisions that reject one key: every value it waits on, and its stop. */
const rejectOf = (one: FactKey): ReadonlyArray<FactOperation> =>
    [...one.proposals, ...(one.retire === null ? [] : [one.retire])].map((fact) => ({
        kind: "decide",
        request: { id: fact.id, action: "reject" },
    }))

/** A set with one member added or removed. */
const flipped = (set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    return next
}

/**
 * The ticks of a table of facts grouped by document or by subject: a whole group, single rows (a conflict cannot be ticked), the bar
 * that counts them at the top of the card, and approving or rejecting them together after one question.
 */
export const useFactPick = (input: FactPickInput): FactPick => {
    const t = useTranslations("brainInbox")
    const batch = useFactBatch()
    const failed = useFailureToast()
    const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
    const [opened, setOpened] = useState<ReadonlyMap<string, boolean>>(() => new Map())
    const [asking, setAsking] = useState<"approve" | "reject" | null>(null)
    const fresh = input.keys.filter((one) => one.kind === "fresh")
    const selected = new Set(fresh.filter((one) => ticked.has(one.key)).map((one) => one.key))
    const grouped = keyGroupsOf(input.keys, { by: input.by, topicOf: input.topicOf, words: input.words })
    const isOpen = (id: string, index: number) => opened.get(id) ?? index === 0
    const groups = grouped.map((group, index) => pickGroupOf(group, input.words, selected, isOpen(group.id, index)))
    const chosen = fresh.filter((one) => selected.has(one.key))
    const touched = grouped.filter((group) => group.keys.some((one) => selected.has(one.key))).length
    const count = chosen.length
    const summaryKey = input.by === "document" ? "selectedDocuments" : "selectedSubjects"
    const bar: PickSelectionBarView = {
        summary: count === 0 ? "" : t(summaryKey, { count, total: fresh.length, groups: touched }),
        hint: t("selectHint"),
        count,
        clearLabel: t("clearSelection"),
        rejectLabel: t("rejectSelected"),
        approveLabel: t("approveSelected", { count }),
        isPending: batch.isPending,
        canWrite: input.canWrite,
    }
    const confirm: PickConfirmView | null =
        asking === null || count === 0
            ? null
            : {
                  tone: asking === "approve" ? "informative" : "negative",
                  title: t(asking === "approve" ? "approveConfirmTitle" : "rejectConfirmTitle", { count }),
                  description: t(asking === "approve" ? "approveConfirmBody" : "rejectConfirmBody", { count }),
                  confirmLabel: asking === "approve" ? t("approve") : t("reject"),
                  cancelLabel: t("cancel"),
              }
    const run = (kind: "approve" | "reject") => {
        const operations = kind === "approve" ? chosen.map((entry) => approveOf(entry)) : chosen.flatMap((entry) => rejectOf(entry))
        const done = (passed: number) => t(kind === "approve" ? "approvedMany" : "rejectedMany", { count: passed })
        batch
            .run(operations, done)
            .then(() => setTicked(new Set()))
            .catch(failed)
    }
    return {
        groups,
        bar,
        confirm,
        on: {
            toggleRow: (key) => {
                if (fresh.some((one) => one.key === key)) setTicked(flipped(selected, key, !selected.has(key)))
            },
            toggleGroup: (groupId) => {
                const group = grouped.find((one) => one.id === groupId)
                if (group === undefined) return
                const own = group.keys.filter((one) => one.kind === "fresh").map((one) => one.key)
                const isAll = own.every((key) => selected.has(key))
                setTicked(own.reduce<ReadonlySet<string>>((set, key) => flipped(set, key, !isAll), selected))
            },
            toggleOpen: (groupId) => {
                const index = grouped.findIndex((one) => one.id === groupId)
                setOpened(new Map(opened).set(groupId, !isOpen(groupId, index)))
            },
            clear: () => setTicked(new Set()),
            askApprove: () => setAsking(input.canWrite && count > 0 ? "approve" : null),
            askReject: () => setAsking(input.canWrite && count > 0 ? "reject" : null),
            cancel: () => setAsking(null),
            confirm: () => {
                setAsking(null)
                if (asking !== null && input.canWrite) run(asking)
            },
        },
    }
}
