"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    SCOPE_KEY,
    SCOPE_TONE,
    FACT_SOURCE_KEY,
    TYPE_KEY,
    needsMaintenance,
    useBrainBoard,
    useBrainCommand,
} from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import { toast } from "@/modules/toast"
import type { BrainFact, KnowledgeRowView, RowActionView } from "@/modules/types"
import { BrainFactsBase } from "./component"

type Translate = ReturnType<typeof useTranslations<"brain">>

interface FactActionContext {
    readonly t: Translate
    readonly canWrite: boolean
    readonly pending: string | undefined
}

/** The fact's two commands keep the exact permission and initiating pending identity. */
const factActionsOf = (id: string, context: FactActionContext): ReadonlyArray<RowActionView> =>
    context.canWrite
        ? [
              { id: "edit", label: context.t("editValue"), href: brainTabHref("facts", { edit: id }) },
              {
                  id: "retire",
                  label: context.t("retire"),
                  intent: "neutral",
                  isPending: context.pending === id,
                  isDisabled: context.pending !== undefined && context.pending !== id,
                  disabledReason: context.t("actionBusy"),
              },
          ]
        : []

/** Validity is still drawn from the persisted dates through the viewer's locale formatter. */
const validityLinesOf = (fact: BrainFact, t: Translate, dayOf: (iso: string) => string): ReadonlyArray<string> => {
    if (fact.validTo !== null) return [t("until", { date: dayOf(fact.validTo) })]
    return fact.validFrom === null ? [] : [t("since", { date: dayOf(fact.validFrom) })]
}

/** Keeps the displayed and actionable facts under the same status rule. */
const shownFactsOf = (facts: ReadonlyArray<BrainFact>) =>
    facts.filter((fact) => (fact.status === "active" || fact.status === "scheduled") && fact.proposalKind === "set")

/** The connected facts list: the facts in force and the scheduled ones, with a new value and a stop. */
export const BrainFacts = () => {
    const t = useTranslations("brain")
    const feedback = useTranslations("toast")
    const format = useFormatter()
    const command = useBrainCommand()
    const [pending, setPending] = useState<string | undefined>()
    const board = useBrainBoard()
    const slotLabels = useSlotLabels()
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const dayOf = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium" })
    const shown = shownFactsOf(board.facts)
    const scheduledBadge = (fact: BrainFact): ReadonlyArray<{ readonly label: string; readonly tone: "accent" }> =>
        fact.status === "scheduled" && fact.validFrom !== null
            ? [{ label: t("scheduledBadge", { date: dayOf(fact.validFrom) }), tone: "accent" }]
            : []
    const rowOf = (fact: BrainFact): KnowledgeRowView => ({
        id: fact.id,
        title: `${fact.subjectLabel} · ${fact.attributeLabel}`,
        lines: [fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`, ...validityLinesOf(fact, t, dayOf)],
        badges: [
            { label: t(TYPE_KEY[fact.subjectType]), tone: "neutral" },
            { label: t(SCOPE_KEY[fact.scope]), tone: SCOPE_TONE[fact.scope] },
            { label: t(FACT_SOURCE_KEY[fact.sourceKind]), tone: "neutral" },
            ...scheduledBadge(fact),
        ],
        actions: factActionsOf(fact.id, { t, canWrite: board.canWrite, pending }),
    })
    const retire = async (rowId: string, actionId: string) => {
        if (!board.canWrite || actionId !== "retire" || !shown.some((fact) => fact.id === rowId)) return
        setPending(rowId)
        try {
            return await command.send("fact.decide", { id: rowId, action: "retire" }, { done: t("retiredDone") })
        } catch {
            failed()
            return undefined
        } finally {
            setPending(undefined)
        }
    }
    const action = (rowId: string, actionId: string) => {
        retire(rowId, actionId).catch(failed)
    }
    return (
        <BrainFactsBase
            props={{
                list: {
                    section: {
                        id: "brain-facts-title",
                        title: t("tabFacts"),
                        failTitle: t("loadFailed"),
                        action: board.canWrite
                            ? { id: "add", label: t("addFact"), href: brainTabHref("facts", { fact: "new" }) }
                            : undefined,
                    },
                    label: t("tabFacts"),
                    footer: t("factsFooter"),
                    isPending: command.isPending,
                    slot: mapSlot(board.slot, (brain) => shownFactsOf(brain.facts).map(rowOf)),
                    slotLabels: slotLabels(t("factsEmpty")),
                },
                maintain:
                    board.canWrite && needsMaintenance(board.facts, board.nowMs)
                        ? { title: t("maintainTitle"), body: t("maintainBody"), actionLabel: t("maintainAction") }
                        : undefined,
            }}
            on={{
                retry: board.reload,
                maintain: () => {
                    command.send("brain.maintain", undefined).catch(failed)
                },
                action,
            }}
        />
    )
}
