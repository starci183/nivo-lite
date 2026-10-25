"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SCOPE_KEY, SCOPE_TONE, FACT_SOURCE_KEY, TYPE_KEY, useBrainBoard, useBrainCommand } from "@/hooks/brain"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { BrainFact } from "@/modules/types"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { BrainFactsBase } from "./component"

/** The connected facts list: the facts in force and the scheduled ones, with a new value and a stop. */
export const BrainFacts = () => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const command = useBrainCommand()
    const board = useBrainBoard()
    const dayOf = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium" })
    const shown = board.facts.filter(
        (fact) => (fact.status === "active" || fact.status === "scheduled") && fact.proposalKind === "set",
    )
    const validityLines = (fact: BrainFact): ReadonlyArray<string> => {
        if (fact.validTo !== null) return [t("until", { date: dayOf(fact.validTo) })]
        return fact.validFrom === null ? [] : [t("since", { date: dayOf(fact.validFrom) })]
    }
    const scheduledBadge = (fact: BrainFact): ReadonlyArray<{ readonly label: string; readonly tone: "accent" }> =>
        fact.status === "scheduled" && fact.validFrom !== null
            ? [{ label: t("scheduledBadge", { date: dayOf(fact.validFrom) }), tone: "accent" }]
            : []
    const rowOf = (fact: BrainFact): KnowledgeRowView => ({
        id: fact.id,
        title: fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`,
        lines: [`${fact.subjectLabel} · ${fact.attributeLabel}`, ...validityLines(fact)],
        badges: [
            { label: t(TYPE_KEY[fact.subjectType]), tone: "neutral" },
            { label: t(SCOPE_KEY[fact.scope]), tone: SCOPE_TONE[fact.scope] },
            { label: t(FACT_SOURCE_KEY[fact.sourceKind]), tone: "neutral" },
            ...scheduledBadge(fact),
        ],
        actions: board.canWrite
            ? [
                  { id: "edit", label: t("editValue"), href: `${KNOWLEDGE_ROUTES.brain}?edit=${fact.id}` },
                  {
                      id: "retire",
                      label: t("retire"),
                      intent: "destructive",
                      onPress: () =>
                          command.send("fact.decide", { id: fact.id, action: "retire" }, { done: t("retiredDone") }),
                  },
              ]
            : [],
    })
    return (
        <BrainFactsBase
            props={{
                list: {
                    section: {
                        id: "brain-facts-title",
                        title: t("tabFacts"),
                        description: t("reviewEmptyBody"),
                        failTitle: t("loadFailed"),
                        action: board.canWrite
                            ? { id: "add", label: t("addFact"), href: `${KNOWLEDGE_ROUTES.brain}?fact=new` }
                            : undefined,
                    },
                    label: t("tabFacts"),
                    rows: shown.map(rowOf),
                    isLoading: board.isLoading,
                    isPending: command.isPending,
                    emptyTitle: t("factsEmpty"),
                },
            }}
        />
    )
}
