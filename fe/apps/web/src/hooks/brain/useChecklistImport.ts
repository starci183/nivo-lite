"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useMutateImportBrainDossiersSwr } from "@/hooks/swr"
import { useReviewRefresh } from "./useReviewRefresh"

/** How many bytes are turned into text at a time. */
const CHUNK = 0x8000

/** The bytes of a file as base64, built in chunks so a large file does not overflow the call stack. */
const base64Of = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const chunks = Array.from({ length: Math.ceil(bytes.length / CHUNK) }, (_, index) =>
        String.fromCodePoint(...bytes.subarray(index * CHUNK, (index + 1) * CHUNK)),
    )
    return btoa(chunks.join(""))
}

/** The entry and dialog of the checklist import, worded, and what they ask of the page. */
export interface ChecklistImport {
    /** The heading entry and, while open, its dialog; null for a member who may only read. */
    readonly view: {
        readonly label: string
        readonly dialog: {
            readonly title: string
            readonly intro: string
            readonly warning: string
            readonly dropLabel: string
            readonly dropPrompt: string
            readonly dropHint: string
            readonly closeLabel: string
            readonly cancelLabel: string
            readonly confirmLabel: string
            readonly fileName: string | null
            readonly isImporting: boolean
        } | null
    } | null
    readonly on: {
        readonly openImport: () => void
        readonly pickImport: (files: Array<File>) => void
        readonly confirmImport: () => void
        readonly closeImport: () => void
    }
}

/** Loads the dossiers of a checklist workbook into the workspace; `onImported` refreshes what shows them. */
export const useChecklistImport = (onImported: () => void, canWrite: boolean): ChecklistImport => {
    const t = useTranslations("dossierReview")
    const run = useReviewRefresh()
    const importer = useMutateImportBrainDossiersSwr()
    const [isOpen, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const close = () => {
        if (importer.isMutating) return
        setOpen(false)
        setFile(null)
    }
    const confirm = async () => {
        if (file === null) return
        const contentBase64 = await base64Of(file)
        const done = await run(() => importer.trigger({ name: file.name, contentBase64 }), t("importDone"))
        if (done === undefined) return
        onImported()
        setOpen(false)
        setFile(null)
    }
    return {
        view: canWrite
            ? {
                  label: t("importChecklist"),
                  dialog: isOpen
                      ? {
                            title: t("importTitle"),
                            intro: t("importIntro"),
                            warning: t("importWarning"),
                            dropLabel: t("importDropLabel"),
                            dropPrompt: t("importDropPrompt"),
                            dropHint: t("importDropHint"),
                            closeLabel: t("importClose"),
                            cancelLabel: t("importCancel"),
                            confirmLabel: t("importConfirm"),
                            fileName: file?.name ?? null,
                            isImporting: importer.isMutating,
                        }
                      : null,
              }
            : null,
        on: {
            openImport: () => setOpen(true),
            pickImport: (files) => setFile(files[0] ?? null),
            confirmImport: () => void confirm(),
            closeImport: close,
        },
    }
}
