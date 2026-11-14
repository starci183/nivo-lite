"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { loadingSlot, mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryBrainCritiqueSwr } from "@/hooks/swr"
import { critiqueGroupsOf, critiqueGroupsPlaceholderOf, critiqueNoticeOf, visibleCritiquePointsOf } from "@/modules/brain"
import type { CritiqueChoiceView, CritiqueEditorView, DocumentQuestionsView } from "@/modules/types"
import { useCritiqueCommands } from "./useCritiqueCommands"
import { useCritiqueWords } from "./useCritiqueWords"

/** What a block needs to read the points of one document. */
interface DocumentCritiqueInput {
    /** The document of the address; undefined while the page only draws its skeleton. */
    readonly sourceId?: string | undefined
    /** The route still loads: every region draws its skeleton whatever the read says. */
    readonly isLoading?: boolean | undefined
}

/** What the points block does. */
interface DocumentCritiqueOn {
    readonly press: (pointId: string, choice: CritiqueChoiceView) => void
    readonly change: (value: string) => void
    readonly send: () => void
    readonly cancel: () => void
    readonly skip: (pointId: string) => void
    readonly retry: () => void
    readonly reload: () => void
}

/** The point being answered with a typed value. */
interface OpenEditor {
    readonly pointId: string
    readonly choiceId: string
    readonly value: string
}

/**
 * The points the document critic raised, one card per kind of doubt, with their buttons. The owner answers with the choices the back end
 * built (a typed choice opens one small input under its point); a manager reads and skips. The read polls while the critic reads; an answer
 * or a skip takes the point out of the list. Text addressed to the AI is shown only to the owner.
 */
export const useDocumentCritique = (
    input: DocumentCritiqueInput,
): { readonly view: DocumentQuestionsView; readonly on: DocumentCritiqueOn } => {
    const t = useTranslations("brainCritique")
    const member = useWorkspaceMember()
    const read = useQueryBrainCritiqueSwr(input.sourceId === undefined ? null : { sourceId: input.sourceId })
    const commands = useCritiqueCommands()
    const catalog = useCritiqueWords()
    const slotLabels = useSlotLabels()
    const [editor, setEditor] = useState<OpenEditor | null>(null)
    const viewer = { isOwner: member.role === "owner" }
    const data = read.data
    const groups = data === undefined ? [] : critiqueGroupsOf(data.points, catalog.words, viewer)
    const choiceOf = (open: OpenEditor): CritiqueChoiceView | undefined =>
        groups
            .flatMap((group) => group.points)
            .find((point) => point.id === open.pointId)
            ?.choices.find((one) => one.id === open.choiceId)
    const openChoice = editor === null ? undefined : choiceOf(editor)
    const editorView: CritiqueEditorView | null =
        editor === null || openChoice === undefined
            ? null
            : { ...editor, label: openChoice.label, hint: openChoice.inputHint ?? openChoice.label }
    return {
        view: {
            slot:
                input.isLoading === true
                    ? loadingSlot()
                    : mapSlot(slotOfSwr(read), (one) => critiqueGroupsOf(one.points, catalog.words, viewer)),
            placeholder: critiqueGroupsPlaceholderOf(catalog.placeholder),
            slotLabels: { ...slotLabels(t("emptyTitle")), error: t("errorTitle") },
            copy: catalog.copy,
            headLine:
                data === undefined
                    ? null
                    : catalog.headLine(data.title, visibleCritiquePointsOf(data.points, viewer).length),
            notice:
                data === undefined
                    ? null
                    : critiqueNoticeOf(data.review, catalog.notice, member.canWrite, commands.isRetrying),
            editor: editorView,
            pendingId: commands.pendingId,
        },
        on: {
            press: (pointId, choice) => {
                if (choice.needsInput) setEditor({ pointId, choiceId: choice.id, value: "" })
                else void commands.answer(pointId, choice.id)
            },
            change: (value) => setEditor((now) => (now === null ? null : { ...now, value })),
            send: () => {
                if (editor === null || editor.value.trim() === "") return
                void commands.answer(editor.pointId, editor.choiceId, editor.value).then((passed) => {
                    if (passed) setEditor(null)
                })
            },
            cancel: () => setEditor(null),
            skip: (pointId) => {
                setEditor((now) => (now?.pointId === pointId ? null : now))
                void commands.skip(pointId)
            },
            retry: () => {
                if (input.sourceId !== undefined) void commands.retry(input.sourceId)
            },
            reload: () => void read.mutate(),
        },
    }
}
