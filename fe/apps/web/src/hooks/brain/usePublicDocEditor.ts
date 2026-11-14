"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { usePublicDocumentEditForm, type PublicDocumentEditValues } from "@/hooks/rhf"
import { mapSlot } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { usePublicDocCommands } from "./usePublicDocCommands"
import { usePublicDocuments } from "./usePublicDocuments"
import type { DataSlot } from "@/modules/types"
import type { PublicDocument } from "@/modules/brain"
import { useWorkspaceId } from "@/hooks/workspaces"

/** Tracks the initiating decision while disabling competing decisions until it settles. */
const usePendingDecision = () => {
    const [pendingAction, setPendingAction] = useState<"save" | "approve" | "redraft" | undefined>()
    const run = async <Result>(kind: "save" | "approve" | "redraft", action: () => Promise<Result>) => {
        setPendingAction(kind)
        try {
            return await action()
        } finally {
            setPendingAction(undefined)
        }
    }
    return { pendingAction, run }
}

/** The view `usePublicDocEditor` returns. */
export interface PublicDocEditorView {
    canWrite: boolean
    slot: DataSlot<PublicDocument[]>
    reload: () => undefined
    doc: PublicDocument | undefined
    isPending: boolean
    pendingAction: "save" | "approve" | "redraft" | undefined
    title: string
    body: string
    error: string | undefined
    close: () => void
    save: (e?: React.BaseSyntheticEvent) => Promise<void>
    approve: (e?: React.BaseSyntheticEvent) => Promise<void>
    redraft: () => Promise<PublicDocument | undefined>
    setTitle: (value: string) => void
    setBody: (value: string) => void
}

/** Keeps approval bound to the exact displayed or saved text and its server-issued revision. */
export const usePublicDocEditor = (docId: string | undefined): PublicDocEditorView => {
    const t = useTranslations("publicBrain")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const commands = usePublicDocCommands()
    const read = usePublicDocuments()
    const doc = read.documents.find((one) => one.id === docId)
    const form = usePublicDocumentEditForm({ title: doc?.title ?? "", body: doc?.body ?? "" })
    const [isReviewStale, setIsReviewStale] = useState(false)
    const decision = usePendingDecision()
    const close = () => router.replace(workspaceHref(workspaceId, brainTabHref("publicDocs")))
    const saveSnapshot = async (values: PublicDocumentEditValues) => {
        if (doc === undefined || !member.canWrite || doc.status === "drafting") return undefined
        const saved =
            values.title === doc.title && values.body === doc.body
                ? doc
                : await commands.update({ id: doc.id, ...values }, t("saved"))
        if (saved !== undefined && (saved.title !== values.title || saved.body !== values.body)) {
            setIsReviewStale(true)
            return undefined
        }
        setIsReviewStale(false)
        return saved
    }
    const approve = form.handleSubmit((values) =>
        decision.run("approve", async () => {
            const reviewedChanges = doc?.needsReview === true
            const saved = await saveSnapshot(values)
            if (saved === undefined) return
            const published = await commands.approve(
                {
                    id: saved.id,
                    expectedDraftRevision: saved.draftRevision,
                    ...(reviewedChanges ? { reviewedChanges: true } : {}),
                },
                t("published"),
            )
            if (published !== undefined) close()
        }),
    )
    return {
        canWrite: member.canWrite,
        slot: mapSlot(read.slot, (documents) => documents.filter((one) => one.id === docId)),
        reload: read.reload,
        doc: member.canWrite ? doc : undefined,
        isPending: commands.isPending || form.formState.isSubmitting,
        pendingAction: decision.pendingAction,
        title: form.watch("title"),
        body: form.watch("body"),
        error:
            form.formState.errors.title?.message ??
            form.formState.errors.body?.message ??
            (isReviewStale ? t("reviewChanged") : undefined),
        close,
        save: form.handleSubmit((values) =>
            decision.run("save", async () => {
                await saveSnapshot(values)
            }),
        ),
        approve,
        redraft: () =>
            decision.run("redraft", () =>
                doc === undefined ? Promise.resolve(undefined) : commands.redraft(doc.id, t("drafting")),
            ),
        setTitle: (value: string) =>
            form.setValue("title", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        setBody: (value: string) =>
            form.setValue("body", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
    }
}
