"use client"

import { useTranslations } from "next-intl"
import { FACT_SOURCE_KEY, adviceFor, reviewBoardOf, useBrainBoard, useBrainCommand, useLessonDesk } from "@/hooks/brain"
import type { ReviewConflict, ReviewSingle } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView, RowActionView, RowPartView } from "@/components/composites/KnowledgeRows"
import type { BrainFact, BrainLesson } from "@/modules/types"
import { BrainReviewBase } from "./component"

/** The connected review list: words each proposal, suggests what to do with it and sends the decision to the back end. */
/** Connects the state and commands used by BrainReview. */
const buildBrainReviewState = (
    board: ReturnType<typeof useBrainBoard>,
    t: ReturnType<typeof useTranslations<"brain">>,
    command: ReturnType<typeof useBrainCommand>,
) => {
    const plan = reviewBoardOf(board.facts)
    const { byLine, titleOf, decide, reject, gated } = reviewRowActions(t, command, board)
    const singleRow = (single: ReviewSingle): KnowledgeRowView => {
        const advice = adviceFor(single.p, single.current, board.nowMs)
        const part: RowPartView = {
            id: single.p.id,
            title: t("newValue", { value: single.p.value }),
            lines: [byLine(single.p), `${t("suggestion")}: ${t(advice.reasonKey, advice.params)}`],
            actions: gated([decide(single.p.id, t("apply"), "apply"), reject(single.p.id, t("reject"))]),
        }
        return {
            id: single.p.id,
            title: titleOf(single.p),
            lines: single.current === null ? [] : [t("currentValue", { value: single.current.value })],
            badges: single.current === null ? [] : [{ label: t("conflict"), tone: "warning" }],
            parts: [part],
        }
    }
    const keepAction = (group: ReviewConflict): ReadonlyArray<RowActionView> => {
        const first = group.options[0]
        if (group.current === null || first === undefined) return []
        return gated([
            {
                id: `keep-${group.key}`,
                label: t("keepCurrentValue"),
                intent: "alternative",
                onPress: () =>
                    command.send(
                        "fact.keep",
                        { subjectKey: first.subjectKey, attribute: first.attribute },
                        { done: t("retireKept") },
                    ),
            },
        ])
    }
    const groupRow = (group: ReviewConflict): KnowledgeRowView => ({
        id: group.key,
        title: `${group.subjectLabel} · ${group.attributeLabel}`,
        lines: [
            t("conflictGroupHint", { n: group.options.length }),
            ...(group.current === null ? [] : [t("currentValue", { value: group.current.value })]),
        ],
        badges: [{ label: t("conflictGroup"), tone: "warning" }],
        actions: keepAction(group),
        parts: group.options.map((option, index) => ({
            id: option.id,
            title: option.value,
            lines: [`${t("conflictOption", { n: index + 1 })} · ${byLine(option)}`],
            actions: gated([decide(option.id, t("apply"), "choose")]),
        })),
    })
    const retireRow = (single: ReviewSingle): KnowledgeRowView => ({
        id: single.p.id,
        title: titleOf(single.p),
        lines: [t("retireBody", { value: single.current?.value ?? single.p.value })],
        badges: [{ label: t("retireBadge"), tone: "warning" }],
        parts: [
            {
                id: single.p.id,
                title: single.current?.value ?? single.p.value,
                lines: [byLine(single.p)],
                actions: gated([decide(single.p.id, t("retireApply"), "apply"), reject(single.p.id, t("retireKeep"))]),
            },
        ],
    })
    return { t, plan, groupRow, singleRow, retireRow, board, command }
}

/** Draws the connected view from its current state. */
export const BrainReview = () => {
    const t = useTranslations("brain")
    const command = useBrainCommand()
    const board = useBrainBoard()
    const slotLabels = useSlotLabels()

    const desk = useLessonDesk("")
    const connected = buildBrainReviewState(board, t, command)
    const { plan, groupRow, singleRow, retireRow } = connected
    const lessonRow = (lesson: BrainLesson): KnowledgeRowView => ({
        id: lesson.id,
        title: lesson.title,
        lines: [lesson.body, ...(lesson.appliesWhen === "" ? [] : [lesson.appliesWhen])],
        badges: [{ label: t("statusProposed"), tone: "warning" }],
        actions: board.canWrite
            ? [
                  {
                      id: "approve",
                      label: t("apply"),
                      intent: "neutral",
                      onPress: () => desk.decide(lesson.id, "active"),
                  },
                  {
                      id: "reject",
                      label: t("reject"),
                      intent: "alternative",
                      onPress: () => desk.decide(lesson.id, "rejected"),
                  },
              ]
            : [],
    })
    return (
        <BrainReviewBase
            props={{
                list: {
                    section: {
                        id: "brain-review-title",
                        title: t("tabReview"),
                        description: t("reviewIntro"),
                        failTitle: t("loadFailed"),
                    },
                    label: t("tabReview"),
                    isPending: command.isPending || desk.isPending,
                    slot: mapSlot(board.slot, () => [
                        ...plan.groups.map(groupRow),
                        ...plan.singles.map(singleRow),
                        ...plan.retires.map(retireRow),
                        ...board.lessons.filter((lesson) => lesson.status === "proposed").map(lessonRow),
                    ]),
                    slotLabels: slotLabels(t("reviewEmptyTitle")),
                },
            }}
            on={{ retry: board.reload }}
        />
    )
}

/** The title of a fact row: its subject and the attribute it states. */
const titleOf = (fact: BrainFact): string => `${fact.subjectLabel} · ${fact.attributeLabel}`

/** Builds the commands and labels shared by all review rows. */
const reviewRowActions = (
    t: ReturnType<typeof useTranslations<"brain">>,
    command: ReturnType<typeof useBrainCommand>,
    board: ReturnType<typeof useBrainBoard>,
) => {
    const byLine = (fact: BrainFact): string =>
        t("by", { who: fact.proposedBy, source: t(FACT_SOURCE_KEY[fact.sourceKind]), trust: fact.trust })
    const decide = (id: string, label: string, action: "apply" | "choose"): RowActionView => ({
        id: `decide-${id}`,
        label,
        intent: "neutral",
        onPress: () => command.send("fact.decide", { id, action }, { done: t("applied") }),
    })
    const reject = (id: string, label: string): RowActionView => ({
        id: `reject-${id}`,
        label,
        intent: "alternative",
        onPress: () => command.send("fact.decide", { id, action: "reject" }, { done: t("rejected") }),
    })
    const gated = (actions: ReadonlyArray<RowActionView>): ReadonlyArray<RowActionView> =>
        board.canWrite ? actions : []
    return { byLine, titleOf, decide, reject, gated }
}
