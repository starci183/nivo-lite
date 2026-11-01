"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    findingsOfFilter,
    queryOfQueue,
    reviewBoardOf,
    todoFiltersOf,
    useBrainBoard,
    useDossierFindings,
    useDossierIdentities,
    useDossierReviewSummary,
    useFindingCards,
    useFindingActions,
} from "@/hooks/brain"
import type { TodoFilter } from "@/hooks/brain"
import { BrainTodoBase } from "./component"

/** What the page hands the queue: the lists it does not draw itself. */
interface BrainTodoProps {
    /** The facts waiting for a decision. */
    readonly facts: ReactNode
    /** The questions customers asked that nobody answered. */
    readonly questions: ReactNode
}

/** The words of the label of each filter besides the kinds of finding. */
const FILTER_KEY = { all: "filterAll", facts: "filterFacts", ask: "filterAsk" } as const

/** Whether a list of the queue is in view under a filter. */
const isIn = (filter: TodoFilter, own: "facts" | "ask"): boolean => filter === "all" || filter === own

/**
 * The connected queue of what needs doing: the findings of the dossier review as cards, the facts waiting and the customer
 * questions, in one list with a filter row. Owners and managers answer; everyone reads.
 */
export const BrainTodo = (props: BrainTodoProps) => {
    const t = useTranslations("dossierReview")
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const board = useBrainBoard()
    const summary = useDossierReviewSummary()
    const list = useDossierFindings(queryOfQueue(), true, summary.revision)
    const { identityOf } = useDossierIdentities()
    const { cardOf } = useFindingCards()
    const [picked, setPicked] = useState<TodoFilter>("all")
    const findings = list.slot.items ?? []
    const { act, dialog } = useFindingActions(findings, list.members)
    const factCards = reviewBoardOf(board.facts).cards
    const questions = board.gaps.length
    const options = todoFiltersOf(findings, factCards, questions)
    const filter = options.some((one) => one.id === picked) ? picked : "all"
    const shown = findingsOfFilter(findings, filter)
    const isFindingsHidden =
        filter === "facts" ||
        filter === "ask" ||
        (list.slot.items !== undefined && shown.length === 0 && factCards + questions > 0)
    const labels = slotLabels(t("emptyTodo"))
    return (
        <BrainTodoBase
            shape={{
                facts: factCards > 0 && isIn(filter, "facts") ? props.facts : null,
                questions: questions > 0 && isIn(filter, "ask") ? props.questions : null,
            }}
            props={{
                filterLabel: t("filterLabel"),
                filters: options.map((one) => ({
                    id: one.id,
                    label: t("filterWithCount", {
                        label: t(
                            one.id === "all" || one.id === "facts" || one.id === "ask"
                                ? FILTER_KEY[one.id]
                                : `kind_${one.id}`,
                        ),
                        n: one.count,
                    }),
                })),
                filter,
                cardsLabel: t("todoLabel"),
                cards: isFindingsHidden
                    ? null
                    : mapSlot(list.slot, (all) =>
                          findingsOfFilter(all, filter).map((one) =>
                              cardOf(one, {
                                  members: list.members,
                                  canWrite: member.canWrite,
                                  dossier: identityOf(one.dossierId ?? undefined),
                              }),
                          ),
                      ),
                slotLabels: labels,
                hasNextPage: list.hasNextPage,
                isLoadingMore: list.isLoadingMore,
                loadMoreLabel: t("loadMore"),
                pageFailure: list.hasPageFailure ? labels.error : null,
                dialog: dialog.view,
            }}
            on={{
                setFilter: (value) => setPicked(options.find((one) => one.id === value)?.id ?? filter),
                action: act,
                loadMore: list.loadMore,
                retry: list.retry,
                submitDialog: (values) => void dialog.submit(values),
                closeDialog: dialog.close,
            }}
        />
    )
}
