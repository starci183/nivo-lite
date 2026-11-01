"use client"

import { useTranslations } from "next-intl"
import { useBrainBoard, useLessonDesk } from "@/hooks/brain"
import type { MineOutcome } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView, RowActionView } from "@/components/composites/KnowledgeRows"
import type { BrainLesson, SlotLabels } from "@/modules/types"
import { BrainLessonsBase } from "./component"

/** Proposed lessons first: they wait for a decision. */
const proposedFirst = (left: BrainLesson, right: BrainLesson): number =>
    Number(right.status === "proposed") - Number(left.status === "proposed")

const STATUS_TONE: Readonly<Record<BrainLesson["status"], "success" | "warning" | "neutral">> = {
    active: "success",
    proposed: "warning",
    retired: "neutral",
    rejected: "neutral",
}

const STATUS_KEY: Readonly<Record<BrainLesson["status"], "statusActive" | "statusProposed" | "statusRetired">> = {
    active: "statusActive",
    proposed: "statusProposed",
    retired: "statusRetired",
    rejected: "statusRetired",
}

/** What an owner can do with a lesson: apply or skip a proposed one, stop using one in force. */
const lessonActionsOf = (
    lesson: BrainLesson,
    t: ReturnType<typeof useTranslations<"brain">>,
    desk: ReturnType<typeof useLessonDesk>,
): ReadonlyArray<RowActionView> => {
    if (lesson.status === "proposed") {
        return [
            { id: "apply", label: t("apply"), intent: "neutral", onPress: () => desk.decide(lesson.id, "active") },
            {
                id: "skip",
                label: t("skipLesson"),
                intent: "dismiss",
                onPress: () => desk.decide(lesson.id, "rejected"),
            },
        ]
    }
    return lesson.status === "active"
        ? [
              {
                  id: "retire",
                  label: t("retireLesson"),
                  intent: "neutral",
                  onPress: () => desk.decide(lesson.id, "retired"),
              },
          ]
        : []
}

/** The connected lessons: how each agent should work, the proposals to approve and the form that writes one. */
/** Connects the state and commands used by BrainLessons. */
const buildBrainLessonsState = (
    t: ReturnType<typeof useTranslations<"brain">>,
    board: ReturnType<typeof useBrainBoard>,
    desk: ReturnType<typeof useLessonDesk>,
) => {
    const agentName = (module: string | null): string =>
        module === null ? t("lessonsAll") : (board.lenses.find((lens) => lens.module === module)?.name ?? module)
    const noticeOf = (mined: MineOutcome): string => {
        if (mined.reason === "not_enough") return t("mineNotEnough", { n: mined.corrections })
        if (mined.reason === "model_unavailable") return t("mineUnavailable")
        return t("mineDone", { n: mined.proposed, c: mined.corrections, k: mined.newCases })
    }
    const rowOf = (lesson: BrainLesson): KnowledgeRowView => {
        const decisions: ReadonlyArray<RowActionView> = lessonActionsOf(lesson, t, desk)
        return {
            id: lesson.id,
            title: lesson.title,
            lines: [lesson.body, ...(lesson.appliesWhen === "" ? [] : [lesson.appliesWhen])],
            badges: [
                { label: agentName(lesson.module), tone: "neutral" },
                { label: t(STATUS_KEY[lesson.status]), tone: STATUS_TONE[lesson.status] },
            ],
            actions: board.canWrite ? decisions : [],
        }
    }
    return { desk, t, noticeOf, board, rowOf }
}

/** Draws the connected view from its current state. */
export const BrainLessons = () => {
    const t = useTranslations("brain")
    const board = useBrainBoard()
    const slotLabels = useSlotLabels()
    const desk = useLessonDesk(board.lenses[0]?.module ?? "")

    const connected = buildBrainLessonsState(t, board, desk)

    return (
        <BrainLessonsBase
            props={brainLessonsProps(connected, slotLabels(t("lessonsEmpty")))}
            on={{
                setAgent: desk.setAgent,
                setLessonTitle: desk.setTitle,
                setLessonBody: desk.setBody,
                setLessonWhen: desk.setWhen,
                mine: desk.mine,
                save: desk.save,
                retry: board.reload,
            }}
        />
    )
}

/** Builds the props supplied to BrainLessonsBase. */
const brainLessonsProps = (
    connected: NonNullable<ReturnType<typeof buildBrainLessonsState>>,
    slotLabels: SlotLabels,
): Parameters<typeof BrainLessonsBase>[0]["props"] => {
    const { t, desk, noticeOf, board, rowOf } = connected
    return {
        list: {
            section: {
                id: "brain-lessons-title",
                title: t("lessonsTitle"),
                failTitle: t("loadFailed"),
                notice: desk.mined === null ? undefined : noticeOf(desk.mined),
            },
            label: t("lessonsTitle"),
            footer: t("lessonsFooter"),
            isPending: desk.isPending,
            slot: mapSlot(board.slot, () => [...board.lessons].sort(proposedFirst).map(rowOf)),
            slotLabels,
        },
        write: board.canWrite
            ? {
                  agentLabel: t("lessonsAgent"),
                  agentOptions: board.lenses.map((lens) => ({ id: lens.module, label: lens.name })),
                  agentPlaceholder: t("selectPlaceholder"),
                  agent: desk.agent,
                  mineLabel: t("mine"),
                  addTitle: t("addLesson"),
                  titleLabel: t("lTitle"),
                  bodyLabel: t("lBody"),
                  whenLabel: t("lWhen"),
                  saveLabel: t("save"),
                  lessonTitle: desk.draft.title,
                  lessonBody: desk.draft.body,
                  lessonWhen: desk.draft.appliesWhen,
                  isPending: desk.isPending,
              }
            : undefined,
    }
}
