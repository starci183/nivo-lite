"use client"

import { useTranslations } from "next-intl"
import type { AddPreset } from "@/hooks/knowledgeAddTypes"
import { DOCUMENT_IDEAS } from "@/modules/documents"
import { useDocsAddress } from "./useDocsAddress"

/** What the address asks of the drawer that adds documents. */
interface AddPresetView {
    /** The drawer is asked for. */
    readonly isOpen: boolean
    /** Changes with what the drawer was opened from, so its form starts again for each. */
    readonly key: string
    readonly preset: AddPreset | null
}

/**
 * The drawer that adds documents, as the address asks for it: with nothing chosen, with the files of a category (topic and tag), or
 * with a note about an idea (the topic of the suggestion).
 */
export const useAddPreset = (): AddPresetView => {
    const t = useTranslations("knowledge")
    const address = useDocsAddress()
    const add = address.add
    if (add === undefined) return { isOpen: false, key: "base", preset: null }
    if (add === "upload" && address.topic !== undefined) {
        return {
            isOpen: true,
            key: `upload:${address.topic}:${address.tag ?? ""}`,
            preset: {
                topic: address.topic,
                mode: "files",
                ...(address.tag === undefined ? {} : { tags: address.tag }),
            },
        }
    }
    const idea = DOCUMENT_IDEAS.find((one) => one.key === add)
    if (idea === undefined) return { isOpen: true, key: "base", preset: null }
    return { isOpen: true, key: add, preset: { topic: t(`suggest_${idea.key}_topic`) } }
}
