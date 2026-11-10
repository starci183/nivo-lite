"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { factDrawerOf, factKeyOf } from "@/modules/brain"
import type { FactDrawerWords, FactKey } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import type { BrainFact, BrainLens, FactDrawerDetailView } from "@/modules/types"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useFactBatch } from "./useFactBatch"
import type { FactOperation } from "./useFactBatch"
import { useFactRetire } from "./useFactRetire"
import { useFailureToast } from "./useFailureToast"

/** What the detail drawer is read against. */
export interface FactDetailDrawerInput {
    readonly tab: BrainTab
    readonly facts: ReadonlyArray<BrainFact>
    readonly keys: ReadonlyArray<FactKey>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    readonly words: FactDrawerWords
}

/** What the detail drawer gives its block: the open drawer (null while closed) and what it does. */
export interface FactDetailDrawerState {
    readonly view: FactDrawerDetailView | null
    readonly on: {
        readonly open: (factId: string) => void
        readonly close: () => void
        /** Closes the drawer and opens the form that gives the fact a new value. */
        readonly edit: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly menu: (id: string) => void
        readonly confirmRetire: () => void
        readonly cancelRetire: () => void
    }
}

/** The decisions of the approve and reject commands of a fact: merged values choose the kept one, a reject rejects every value of the key. */
const operationsOf = (
    fact: BrainFact,
    one: FactKey | undefined,
    kind: "approve" | "reject",
): ReadonlyArray<FactOperation> => {
    if (kind === "reject") {
        const all = one === undefined ? [fact] : [...one.proposals, ...(one.retire === null ? [] : [one.retire])]
        return all.map((each): FactOperation => ({ kind: "decide", request: { id: each.id, action: "reject" } }))
    }
    const action = (one?.proposals.length ?? 0) > 1 ? "choose" : "apply"
    return [{ kind: "decide", request: { id: fact.id, action } }]
}

/**
 * The detail of one fact in a drawer: its value, the words it was quoted in, who reads it and its history on demand. Approve is the
 * primary with Edit value beside it; Reject stands apart; stopping a value in use sits last in the menu, in the danger tone, and asks first.
 */
export const useFactDetailDrawer = (input: FactDetailDrawerInput): FactDetailDrawerState => {
    const t = useTranslations("brainInbox")
    const f = useTranslations("brainFacts")
    const workspaceId = useWorkspaceId()
    const router = navigation.useRouter()
    const batch = useFactBatch()
    const failed = useFailureToast()
    const retire = useFactRetire(input.canWrite)
    const [openId, setOpenId] = useState<string | null>(null)
    const [pending, setPending] = useState<"approve" | "reject" | null>(null)
    const [isHistoryOpen, setHistoryOpen] = useState(false)
    const fact = input.facts.find((one) => one.id === openId)
    const one = fact === undefined ? undefined : input.keys.find((key) => key.key === factKeyOf(fact))
    const close = () => {
        setOpenId(null)
        setHistoryOpen(false)
    }
    const view =
        fact === undefined
            ? null
            : factDrawerOf({
                  fact,
                  facts: input.facts,
                  lenses: input.lenses,
                  canWrite: input.canWrite,
                  pending: retire.pending === fact.id ? "retire" : pending,
                  isHistoryOpen,
                  retire:
                      retire.asking === fact.id
                          ? {
                                tone: "negative",
                                title: f("retireTitle"),
                                description: f("retireBody", {
                                    title: `${fact.subjectLabel} · ${fact.attributeLabel}`,
                                }),
                                confirmLabel: f("retireConfirm"),
                                cancelLabel: f("retireCancel"),
                            }
                          : null,
                  words: input.words,
              })
    const decide = (kind: "approve" | "reject") => {
        if (fact === undefined || !input.canWrite || pending !== null) return
        setPending(kind)
        batch
            .run(operationsOf(fact, one, kind), (count) =>
                kind === "approve" ? t("approved") : t("rejectedMany", { count }),
            )
            .then((passed) => {
                if (passed > 0) close()
            })
            .catch(failed)
            .finally(() => setPending(null))
    }
    return {
        view,
        on: {
            open: (factId) => {
                setOpenId(factId)
                setHistoryOpen(false)
            },
            close,
            edit: () => {
                if (fact === undefined) return
                close()
                router.push(workspaceHref(workspaceId, brainTabHref(input.tab, { edit: fact.id })))
            },
            approve: () => decide("approve"),
            reject: () => decide("reject"),
            menu: (id) => {
                if (id === "history") setHistoryOpen(!isHistoryOpen)
                if (id === "retire" && fact !== undefined) retire.ask(fact.id)
            },
            confirmRetire: () => {
                retire.confirm().then(close).catch(failed)
            },
            cancelRetire: () => retire.ask(null),
        },
    }
}
