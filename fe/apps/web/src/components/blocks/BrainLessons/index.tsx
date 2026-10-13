"use client"

import { useTranslations } from "next-intl"
import { useLessonDesk } from "@/hooks/brain"
import type { MineOutcome } from "@/hooks/brain"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import type { BrainLens, BrainLesson } from "@/modules/types"
import { BrainLessonsBase } from "./component"

/** Props for the connected lessons. */
interface BrainLessonsProps {
    readonly workspaceId: string
    readonly lessons: ReadonlyArray<BrainLesson>
    /** The agents a lesson may be for. */
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    /** True while the page loads: the heading stays and the list is skeleton rows. */
    readonly isLoading?: boolean
}

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

/** What can be decided about a lesson. */
type LessonAction = "active" | "rejected" | "retired"

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected lessons: how each agent should work, the proposals to approve and the form that writes one. */
export const BrainLessons = (props: BrainLessonsProps) => {
    const t = useTranslations("brain")
    const desk = useLessonDesk(props.workspaceId, props.lenses[0]?.module ?? "", ACTIONS)
    const agentName = (module: string | null): string =>
        module === null ? t("lessonsAll") : (props.lenses.find((lens) => lens.module === module)?.name ?? module)
    const noticeOf = (mined: MineOutcome): string => {
        if (mined.reason === "not_enough") return t("mineNotEnough", { n: mined.corrections })
        if (mined.reason === "model_unavailable") return t("mineUnavailable")
        return t("mineDone", { n: mined.proposed, c: mined.corrections, k: mined.newCases })
    }
    const rowOf = (lesson: BrainLesson): KnowledgeRowView => {
        const decide = (id: string, label: string, action: LessonAction, variant: "primary" | "ghost") => ({
            id,
            label,
            variant,
            onPress: () => desk.decide(lesson.id, action),
        })
        const approve =
            lesson.status === "proposed"
                ? [
                      decide("approve", t("apply"), "active", "primary"),
                      decide("reject", t("reject"), "rejected", "ghost"),
                  ]
                : []
        const retire = lesson.status === "active" ? [decide("retire", t("retireLesson"), "retired", "ghost")] : []
        return {
            id: lesson.id,
            title: lesson.title,
            lines: [lesson.body, ...(lesson.appliesWhen === "" ? [] : [lesson.appliesWhen])],
            badges: [
                { label: agentName(lesson.module), tone: "neutral" },
                { label: t(STATUS_KEY[lesson.status]), tone: STATUS_TONE[lesson.status] },
            ],
            actions: props.canWrite ? [...approve, ...retire] : [],
        }
    }
    return (
        <BrainLessonsBase
            props={{
                list: {
                    section: {
                        id: "brain-lessons-title",
                        title: t("tabLessons"),
                        description: t("lessonsIntro"),
                        failTitle: t("loadFailed"),
                        error: desk.errorKey === null ? undefined : t(desk.errorKey),
                        notice: desk.mined === null ? undefined : noticeOf(desk.mined),
                    },
                    label: t("tabLessons"),
                    rows: props.lessons.map(rowOf),
                    isLoading: props.isLoading ?? false,
                    isPending: desk.isPending,
                    emptyTitle: t("lessonsEmpty"),
                },
                write: props.canWrite
                    ? {
                          agentLabel: t("lessonsAgent"),
                          agentOptions: props.lenses.map((lens) => ({ id: lens.module, label: lens.name })),
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
            }}
            on={{
                setAgent: desk.setAgent,
                setLessonTitle: desk.setTitle,
                setLessonBody: desk.setBody,
                setLessonWhen: desk.setWhen,
                mine: desk.mine,
                save: desk.save,
            }}
        />
    )
}
