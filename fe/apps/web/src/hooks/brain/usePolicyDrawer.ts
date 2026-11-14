"use client"

import { today } from "@internationalized/date"
import { useState } from "react"
import { useQueryBrainPolicySwr } from "@/hooks/swr"
import {
    SHOP_TIME_ZONE,
    policyFormOf,
    policyHistoryOf,
    policyKindOf,
    policyNameOf,
    policyReadersOf,
    policyReasonOf,
    policySourceOf,
    policyValueTextOf,
    type PolicyDetailData,
    type PolicyWords,
} from "@/modules/brain"
import type { PolicyDrawerView, PolicyFormView, PolicyProposalView } from "@/modules/types"
import { usePolicyCommands } from "./usePolicyCommands"
import { usePolicyDrawerCopy } from "./usePolicyDrawerCopy"
import { usePolicyWords } from "./usePolicyWords"

/** What opens the drawer and what it needs from the tab. */
interface PolicyDrawerInput {
    /** The fact the address opens; undefined while no rule is open. */
    readonly factId: string | undefined
    readonly close: () => void
    readonly moduleName: (module: string) => string
}

/** The edits typed into one rule, and the sentence of its refused value; they belong to that rule only. */
interface Draft {
    readonly factId: string
    readonly change: Partial<PolicyFormView>
    readonly error: string | undefined
}

/** What the proposal rows are made of. */
interface ProposalsInput {
    readonly detail: PolicyDetailData
    readonly words: PolicyWords
    readonly moduleName: (module: string) => string
    readonly deciding: string | undefined
}

/** The proposals waiting, newest first, as the owner decides them; a manager sees none (no buttons are theirs). */
const proposalsOf = (input: ProposalsInput): ReadonlyArray<PolicyProposalView> =>
    input.detail?.canEdit === true
        ? input.detail.proposals.map((one) => ({
              id: one.factId,
              value: one.value,
              line: [input.moduleName(one.proposedBy), policySourceOf(one.source, input.words)]
                  .filter((part) => part !== "")
                  .join(" · "),
              isPending: input.deciding?.startsWith(`${one.factId}:`) ?? false,
          }))
        : []

/**
 * The drawer that edits one shop rule (a short form; the owner only): the value in its typed control, who may know it, when it takes
 * effect, the proposals waiting (use one or dismiss it, through the existing fact decision) and the history. One save writes a new
 * version of the fact; a refused value stays in the drawer with its reason, a refused caller is the failure toast.
 */
export const usePolicyDrawer = (input: PolicyDrawerInput): PolicyDrawerView => {
    const words = usePolicyWords()
    const copy = usePolicyDrawerCopy()
    const commands = usePolicyCommands()
    const read = useQueryBrainPolicySwr(input.factId ?? null)
    const [draft, setDraft] = useState<Draft | null>(null)
    const detail = read.data ?? null
    const factId = input.factId ?? ""
    const own = draft?.factId === factId ? draft : null
    const current = detail?.row.current ?? null
    const base = policyFormOf(current, today(SHOP_TIME_ZONE).toString())
    const form: PolicyFormView = { ...base, ...own?.change }
    const kind = policyKindOf(detail?.row.type ?? "text")
    const close = () => {
        setDraft(null)
        input.close()
    }
    const submit = async () => {
        if (detail === null || !detail.canEdit || commands.isSaving) return
        const value = policyValueTextOf(kind, form, words)
        const initial = policyValueTextOf(kind, base, words)
        const refused = await commands.save({ detail, form, base, value, initial }, words.dayMonth)
        if (typeof refused === "string") setDraft({ factId, change: own?.change ?? {}, error: refused })
        else if (refused === null) close()
    }
    return {
        props: {
            isOpen: input.factId !== undefined,
            isLoading: read.isLoading,
            isFailed: read.error !== undefined || (read.data === null && !read.isLoading),
            isPending: commands.isSaving,
            title: detail === null ? "" : policyNameOf(detail.row),
            reason: policyReasonOf(detail?.row.reason),
            kind,
            per: current?.parameter.per ?? null,
            readers: current === null ? words.readAll : policyReadersOf(current.audience, words, input.moduleName),
            form,
            proposals: proposalsOf({ detail, words, moduleName: input.moduleName, deciding: commands.deciding }),
            history: policyHistoryOf(detail?.history ?? [], words),
            error: own?.error,
            copy,
        },
        on: {
            close,
            submit: () => void submit(),
            patch: (change) => setDraft({ factId, change: { ...own?.change, ...change }, error: undefined }),
            use: (id) => {
                if (detail !== null) void commands.decide(detail, id, "use")
            },
            reject: (id) => {
                if (detail !== null) void commands.decide(detail, id, "reject")
            },
        },
    }
}
