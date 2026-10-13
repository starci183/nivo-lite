"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SCOPE_KEY, SCOPE_TONE, SOURCE_KEY, TYPE_KEY, useBrainCommand } from "@/hooks/brain"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { BrainFact } from "@/modules/types"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { BrainFactsBase } from "./component"

/** Props for the connected facts list. */
interface BrainFactsProps {
    readonly workspaceId: string
    readonly facts: ReadonlyArray<BrainFact>
    readonly canWrite: boolean
    /** True while the page loads: the heading stays and the list is skeleton rows. */
    readonly isLoading?: boolean
}

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected facts list: the facts in force and the scheduled ones, with a new value and a stop. */
export const BrainFacts = (props: BrainFactsProps) => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const command = useBrainCommand(props.workspaceId, ACTIONS)
    const dayOf = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium" })
    const shown = props.facts.filter(
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
            { label: t(SOURCE_KEY[fact.sourceKind]), tone: "neutral" },
            ...scheduledBadge(fact),
        ],
        actions: props.canWrite
            ? [
                  { id: "edit", label: t("editValue"), href: `${KNOWLEDGE_ROUTES.brain}?edit=${fact.id}` },
                  {
                      id: "retire",
                      label: t("retire"),
                      variant: "ghost",
                      onPress: () =>
                          command.send("fact.decide", { id: fact.id, action: "retire" }, { done: t("retiredDone") }),
                  },
              ]
            : [],
    })
    const note = command.note
    return (
        <BrainFactsBase
            props={{
                list: {
                    section: {
                        id: "brain-facts-title",
                        title: t("tabFacts"),
                        description: t("reviewEmptyBody"),
                        failTitle: t("loadFailed"),
                        error: note?.tone === "negative" ? t(note.text) : undefined,
                        notice: note?.tone === "affirmative" ? note.text : undefined,
                        action: props.canWrite
                            ? { id: "add", label: t("addFact"), href: `${KNOWLEDGE_ROUTES.brain}?fact=new` }
                            : undefined,
                    },
                    label: t("tabFacts"),
                    rows: shown.map(rowOf),
                    isLoading: props.isLoading ?? false,
                    isPending: command.isPending,
                    emptyTitle: t("factsEmpty"),
                },
            }}
        />
    )
}
