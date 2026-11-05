"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_BRAIN_SWR_KEY, useMutateRequestLessonMiningSwr, useQueryLessonMiningStatusSwr } from "@/hooks/swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { mineOutcomeOf } from "@/modules/brain"
import type { MineOutcome } from "@/modules/brain"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useBrainCommand } from "./useBrainCommand"

/** The lesson form, as the person typed it. */
interface LessonDraft {
    readonly title: string
    readonly body: string
    readonly appliesWhen: string
    /** The agent the lesson is for; `all` for every agent. */
    readonly agent: string
}

/** The agent value that stands for every agent. */
const ALL_AGENTS = "all"

const EMPTY_DRAFT: LessonDraft = { title: "", body: "", appliesWhen: "", agent: ALL_AGENTS }

/** What the lessons desk gives its tab. */
interface LessonDesk {
    readonly draft: LessonDraft
    readonly mined: MineOutcome | null
    /** A study of the corrections is on (asked, or being read back). */
    readonly isMining: boolean
    /** Any command of the desk is on. */
    readonly isPending: boolean
    readonly setTitle: (value: string) => void
    readonly setBody: (value: string) => void
    readonly setWhen: (value: string) => void
    readonly setDraftAgent: (value: string | null) => void
    readonly mine: (agent: string) => Promise<void>
    /** Saves the lesson of the form; `onSaved` runs once it went through. */
    readonly save: (onSaved: () => void) => void
    readonly decide: (
        id: string,
        action: "active" | "rejected" | "retired",
    ) => ReturnType<ReturnType<typeof useBrainCommand>["send"]>
}

/** The desk where lessons are studied from corrections, written by hand and decided; the brain read revalidates after each. */
export const useLessonDesk = (): LessonDesk => {
    const t = useTranslations("brain")
    const feedback = useTranslations("toast")
    const command = useBrainCommand()
    const runGraphQL = useGraphQLWithToast()
    const workspace = useWorkspaceKey(QUERY_BRAIN_SWR_KEY, [])
    const { trigger: requestMining, isMutating: isRequesting } = useMutateRequestLessonMiningSwr()
    const [draft, setDraft] = useState<LessonDraft>(EMPTY_DRAFT)
    const [miningId, setMiningId] = useState<string | undefined>()
    const [mined, setMined] = useState<MineOutcome | null>(null)
    useQueryLessonMiningStatusSwr(miningId, (mining) =>
        runGraphQL(
            async () => {
                if (mining.status === "done") {
                    setMined(mineOutcomeOf(mining))
                    setMiningId(undefined)
                    if (workspace !== null)
                        await mutate(
                            (key) => Array.isArray(key) && key[0] === QUERY_BRAIN_SWR_KEY && key[1] === workspace[1],
                        )
                } else if (mining.status === "failed") {
                    toast.danger(t("mineFailed"), { description: mining.errorCode ?? undefined })
                    setMiningId(undefined)
                }
            },
            { showSuccessToast: false },
        ),
    )
    const isMining = isRequesting || miningId !== undefined
    return {
        draft,
        mined,
        isMining,
        isPending: command.isPending || isMining,
        setTitle: (title) => setDraft((now) => ({ ...now, title })),
        setBody: (body) => setDraft((now) => ({ ...now, body })),
        setWhen: (appliesWhen) => setDraft((now) => ({ ...now, appliesWhen })),
        setDraftAgent: (value) => setDraft((now) => ({ ...now, agent: value ?? now.agent })),
        mine: async (agent) => {
            setMined(null)
            const ref = await runGraphQL(() => requestMining({ module: agent }), { showSuccessToast: false })
            if (ref !== undefined) setMiningId(ref.id)
        },
        save: (onSaved) => {
            if (draft.title.trim() === "" || draft.body.trim() === "") return
            command
                .send(
                    "lesson.save",
                    {
                        module: draft.agent === ALL_AGENTS ? null : draft.agent,
                        title: draft.title,
                        body: draft.body,
                        appliesWhen: draft.appliesWhen === "" ? null : draft.appliesWhen,
                    },
                    {
                        onResult: () => {
                            setDraft(EMPTY_DRAFT)
                            onSaved()
                        },
                    },
                )
                .catch(() => {
                    toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
                })
        },
        decide: (id, action) => command.send("lesson.decide", { id, action }),
    }
}
