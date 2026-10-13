"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useEffect, useState, useTransition } from "react"
import type { ContextNote } from "@/lib/context-notes"
import { approveNoteAndApply, dismissNote, listPendingNotes, loadKnowledgeCounts } from "@/lib/context-notes-actions"
import type { ModuleKey } from "@/modules/catalog"
import { SetupKnowledgeBase } from "./component"

/** How many sources of each kind the knowledge of a module holds. */
type Counts = { readonly nivo: number; readonly business: number; readonly publicSources: number }

/** What the setup hands the knowledge cards. */
type SetupKnowledgeProps = {
    readonly installationId: string
    readonly moduleKey: ModuleKey
    /** Changes when the draft changes (revision, fact count): reloads the notes. */
    readonly refreshKey: string
    readonly onApplied: () => void
    /** The card labels stay, the counts and notes are skeletons and nothing is read. */
    readonly isLoading: boolean
}

/** What the last approve or dismiss said. */
type Message = { readonly tone: "idle" | "applied" | "refused"; readonly text: string }

const KNOWLEDGE_ROUTE = "/knowledge"
const NIVO_KNOWLEDGE_ROUTE = "/knowledge/nivo"

/** The connected knowledge cards of the setup: what the module runs on, and the notes from Office waiting for approval. */
export const SetupKnowledge = (props: SetupKnowledgeProps) => {
    const t = useTranslations("moduleSetup")
    const format = useFormatter()
    const [counts, setCounts] = useState<Counts | null>(null)
    const [notes, setNotes] = useState<ReadonlyArray<ContextNote>>([])
    const [message, setMessage] = useState<Message>({ tone: "idle", text: "" })
    const [isPending, start] = useTransition()
    const { installationId, moduleKey, refreshKey, isLoading } = props

    const load = useCallback(async () => {
        const [loadedCounts, loadedNotes] = await Promise.all([
            loadKnowledgeCounts(moduleKey),
            listPendingNotes(installationId),
        ])
        if (loadedCounts.ok) setCounts(loadedCounts.data)
        if (loadedNotes.ok) setNotes(loadedNotes.data)
    }, [moduleKey, installationId])
    useEffect(() => {
        if (!isLoading) void load()
    }, [load, refreshKey, isLoading])

    const approve = () => {
        setMessage({ tone: "idle", text: "" })
        start(async () => {
            const result = await approveNoteAndApply(installationId)
            if (!result.ok) {
                setMessage({ tone: "refused", text: result.error })
                return
            }
            setMessage({ tone: "applied", text: t("k_notesApplied", { version: result.data.version }) })
            await load()
            props.onApplied()
        })
    }
    const dismiss = (id: string) => {
        setMessage({ tone: "idle", text: "" })
        start(async () => {
            const result = await dismissNote(id)
            if (!result.ok) setMessage({ tone: "refused", text: result.error })
            await load()
            props.onApplied()
        })
    }
    const business = counts?.business ?? 0
    return (
        <SetupKnowledgeBase
            props={{
                isLoading,
                cardTitle: t("k_cardTitle"),
                nivoLine: t("k_cardNivo", { count: counts?.nivo ?? 0 }),
                businessLine: t("k_cardBusiness", { count: business }),
                publicLine: business > 0 ? t("k_cardPublic", { count: counts?.publicSources ?? 0 }) : "",
                emptyHint: counts !== null && business === 0 ? t("k_cardEmpty") : "",
                knowledgeHref: `${KNOWLEDGE_ROUTE}?module=${moduleKey}`,
                knowledgeLabel: t("k_cardLink"),
                nivoHref: NIVO_KNOWLEDGE_ROUTE,
                nivoLabel: t("k_nivoLink"),
                notesTitle: t("k_notesTitle"),
                notesHint: t("k_notesHint"),
                notesEmpty: t("k_notesEmpty"),
                notes: notes.map((note) => ({
                    id: note.id,
                    body: note.body,
                    meta: t("k_notesFrom", {
                        source: note.source === "office" ? t("k_notesSourceOffice") : t("k_notesSourceSetup"),
                        who: note.authorName,
                        when: format.dateTime(new Date(note.createdAt), { dateStyle: "short", timeStyle: "short" }),
                    }),
                })),
                dismissLabel: t("k_notesDismiss"),
                approveLabel: isPending ? t("k_notesApproving") : t("k_notesApprove"),
                isPending,
                messageTone: message.tone,
                messageTitle: message.tone === "applied" ? t("k_notesTitle") : t("k_notesFailed"),
                messageText: message.text,
            }}
            on={{ approve, dismiss }}
        />
    )
}
