"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { LessonDrawerView } from "@/modules/types"
import { useLessonDesk } from "./useLessonDesk"
import { useWorkspaceId } from "@/hooks/workspaces"

type Desk = ReturnType<typeof useLessonDesk>

/** What the lesson drawer is told: whether the address opens it, who may write, and the agents a lesson may be for. */
interface LessonDrawerInput {
    readonly isRequested: boolean
    readonly canWrite: boolean
    readonly agentOptions: LessonDrawerView["props"]["agentOptions"]
    readonly agentLabel: string
    readonly agentPlaceholder: string
    readonly desk: Desk
}

/** The drawer that writes a lesson by hand: opened by the address, closed through it; null where it is not asked for. */
export const useLessonDrawer = (input: LessonDrawerInput): LessonDrawerView | null => {
    const t = useTranslations("brain")
    const l = useTranslations("brainLessons")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { desk } = input
    if (!input.canWrite || !input.isRequested) return null
    const close = () => router.replace(workspaceHref(workspaceId, brainTabHref("lessons")))
    return {
        props: {
            isOpen: true,
            isPending: desk.isPending,
            title: l("addLesson"),
            closeLabel: t("cancel"),
            cancelLabel: t("cancel"),
            saveLabel: t("save"),
            agentLabel: input.agentLabel,
            agentOptions: input.agentOptions,
            agentPlaceholder: input.agentPlaceholder,
            agent: desk.draft.agent,
            titleLabel: t("lTitle"),
            bodyLabel: t("lBody"),
            whenLabel: t("lWhen"),
            lessonTitle: desk.draft.title,
            lessonBody: desk.draft.body,
            lessonWhen: desk.draft.appliesWhen,
        },
        on: {
            close,
            submit: () => desk.save(close),
            setAgent: desk.setDraftAgent,
            setTitle: desk.setTitle,
            setBody: desk.setBody,
            setWhen: desk.setWhen,
        },
    }
}
