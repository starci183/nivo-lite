"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useBrainBoard, useLessonDesk, type MineOutcome, useFailureToast } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView, RowActionView, BrainLesson, SlotLabels } from "@/modules/types"
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
): ReadonlyArray<RowActionView> => {
    if (lesson.status === "proposed") {
        return [
            { id: "apply", label: t("apply"), intent: "neutral" },
            {
                id: "skip",
                label: t("skipLesson"),
                intent: "dismiss",
            },
        ]
    }
    return lesson.status === "active"
        ? [
              {
                  id: "retire",
                  label: t("retireLesson"),
                  intent: "neutral",
              },
          ]
        : []
}

/** The connected lessons: how each agent should work, the proposals to approve and the form that writes one. */
/** Connects the state and commands used by BrainLessons. */
interface LessonsStateInput {
    readonly t: ReturnType<typeof useTranslations<"brain">>
    readonly board: ReturnType<typeof useBrainBoard>
    readonly desk: ReturnType<typeof useLessonDesk>
    readonly pending: string | undefined
}

const buildBrainLessonsState = (input: LessonsStateInput) => {
    const { t, board, desk, pending } = input
    const agentName = (module: string | null): string =>
        module === null ? t("lessonsAll") : (board.lenses.find((lens) => lens.module === module)?.name ?? module)
    const noticeOf = (mined: MineOutcome): string => {
        if (mined.reason === "not_enough") return t("mineNotEnough", { n: mined.corrections })
        if (mined.reason === "model_unavailable") return t("mineUnavailable")
        return t("mineDone", { n: mined.proposed, c: mined.corrections, k: mined.newCases })
    }
    const rowOf = (lesson: BrainLesson): KnowledgeRowView => {
        const decisions: ReadonlyArray<RowActionView> = lessonActionsOf(lesson, t)
        return {
            id: lesson.id,
            title: lesson.title,
            lines: [lesson.body, ...(lesson.appliesWhen === "" ? [] : [lesson.appliesWhen])],
            badges: [
                { label: agentName(lesson.module), tone: "neutral" },
                { label: t(STATUS_KEY[lesson.status]), tone: STATUS_TONE[lesson.status] },
            ],
            actions: board.canWrite
                ? decisions.map((action) => ({
                      ...action,
                      isPending: pending === `${lesson.id}:${action.id}`,
                      isDisabled: pending !== undefined && pending !== `${lesson.id}:${action.id}`,
                      disabledReason: t("actionBusy"),
                  }))
                : [],
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
    const [pending, setPending] = useState<string | undefined>()
    const failed = useFailureToast()

    const connected = buildBrainLessonsState({ t, board, desk, pending })
    const decide = async (rowId: string, actionId: string) => {
        if (!board.canWrite || !board.lessons.some((lesson) => lesson.id === rowId)) return
        const state = lessonStateOf(actionId)
        if (state === undefined) return
        setPending(`${rowId}:${actionId}`)
        try {
            return await desk.decide(rowId, state)
        } catch {
            failed()
            return undefined
        } finally {
            setPending(undefined)
        }
    }
    const action = (rowId: string, actionId: string) => {
        decide(rowId, actionId).catch(failed)
    }

    return (
        <BrainLessonsBase
            props={brainLessonsProps(connected, slotLabels(t("lessonsEmpty")))}
            on={{
                setAgent: desk.setAgent,
                setLessonTitle: desk.setTitle,
                setLessonBody: desk.setBody,
                setLessonWhen: desk.setWhen,
                mine: () => {
                    desk.mine().catch(failed)
                },
                save: desk.save,
                retry: board.reload,
                action,
            }}
        />
    )
}

/** Maps only the declared row decisions to their backend state. */
const lessonStateOf = (action: string) => {
    if (action === "apply") return "active"
    if (action === "skip") return "rejected"
    return action === "retire" ? "retired" : undefined
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
            slot: mapSlot(board.slot, (brain) => [...brain.lessons].sort(proposedFirst).map(rowOf)),
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
