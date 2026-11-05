"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { PublicBrainView } from "@/modules/types"
import { useFailureToast } from "./useFailureToast"
import { usePublicDocCommands } from "./usePublicDocCommands"
import type { PublicDocEditorView } from "./usePublicDocEditor"

/** What the commands over the open public document act on. */
interface PublicDraftCommandsInput {
    readonly docId: string | undefined
    readonly editor: PublicDocEditorView
    /** Leaves the document: back to the list. */
    readonly close: () => void
}

/** The commands over the open public document and the state of its archive confirmation. */
interface PublicDraftCommandsView {
    readonly isRemoveOpen: boolean
    readonly isRemoving: boolean
    readonly on: Pick<
        PublicBrainView["on"],
        "setTitle" | "setBody" | "save" | "redraft" | "approve" | "menu" | "removeOpenChange" | "remove"
    >
}

/** The commands over the open public document: edit, save, draft again, approve, and archive behind its confirmation. */
export const usePublicDraftCommands = (input: PublicDraftCommandsInput): PublicDraftCommandsView => {
    const t = useTranslations("publicBrain")
    const failed = useFailureToast()
    const commands = usePublicDocCommands()
    const [isRemoveOpen, setIsRemoveOpen] = useState(false)
    const { editor } = input
    return {
        isRemoveOpen,
        isRemoving: commands.isPending,
        on: {
            setTitle: editor.setTitle,
            setBody: editor.setBody,
            save: () => {
                editor.save().catch(failed)
            },
            redraft: () => {
                editor.redraft().catch(failed)
            },
            approve: () => {
                editor.approve().catch(failed)
            },
            menu: (id: string) => {
                if (id === "archive") setIsRemoveOpen(true)
            },
            removeOpenChange: setIsRemoveOpen,
            remove: async (): Promise<void> => {
                if (input.docId === undefined) return
                const archived = await commands.archive(input.docId, t("archived"))
                if (archived !== true) throw new Error("public document archive did not succeed")
                setIsRemoveOpen(false)
                input.close()
            },
        },
    }
}
