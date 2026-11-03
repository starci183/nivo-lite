"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useInventoryRun } from "@/hooks/inventory"
import { useInventoryStockCommands } from "@/hooks/inventoryCommands"
import { useInventoryTemplates } from "@/hooks/inventoryStarter"
import type { InventoryTemplateChoice } from "@/modules/types"
import type { SWRResponse } from "swr"

/** The view `useInventoryImportView` returns. */
export interface InventoryImportView {
    readonly props: {
        readonly allowed: boolean
        readonly deniedTitle: string
        readonly deniedBody: string
        readonly pasteTitle: string
        readonly pasteHelp: string
        readonly pasteLabel: string
        readonly pastePlaceholder: string
        readonly pasteSubmit: string
        readonly text: string
        readonly startTitle: string
        readonly startFooter: string
        readonly loadLabel: string
        readonly templates: InventoryTemplateChoice[]
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly onText: (value: string) => void
        readonly onPaste: () => void
        readonly onLoad: (key: string) => void
    }
    readonly templateRead: SWRResponse<
        {
            description: string
            key: string
            name: string
        }[]
    >
    readonly retryTemplates: () => Promise<
        | {
              description: string
              key: string
              name: string
          }[]
        | undefined
    >
}

/** The import tab: the pasted text lives here, the drawing in the pure half. */
export const useInventoryImportView = (input: InventoryPanelInput): InventoryImportView => {
    const board = input.board
    const t = useTranslations("workbenchInventory")
    const commands = useInventoryStockCommands()
    const templatesRead = useInventoryTemplates(input.isActive)
    const { templates } = templatesRead
    const run = useInventoryRun(input.isActive, input.scope)
    const [text, setText] = useState("")
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setText("")
        },
    })
    const paste = () =>
        run.exec(
            () => commands.importPaste(text),
            (result, isCurrent) => {
                if (isCurrent()) setText("")
                return t("importDone", {
                    created: result.created,
                    updated: result.updated,
                    stocked: result.stocked,
                    skipped: result.skipped.length > 0 ? t("importSkipped", { n: result.skipped.length }) : "",
                })
            },
        )
    const load = (key: string) =>
        run.exec(
            () => commands.applyStarter(key),
            (result) => t("starterDone", { items: result.items, suppliers: result.suppliers, recipes: result.recipes }),
        )
    return {
        props: {
            allowed: board.canManage,
            deniedTitle: t("importDeniedTitle"),
            deniedBody: t("importDeniedBody"),
            pasteTitle: t("importPasteTitle"),
            pasteHelp: t("importPasteHelp"),
            pasteLabel: t("importPasteLabel"),
            pastePlaceholder: t("importPastePlaceholder"),
            pasteSubmit: t("importSubmit"),
            text,
            startTitle: t("starterTitle"),
            startFooter: t("starterFooter"),
            loadLabel: t("starterLoad"),
            templates,
            isPending: run.isPending,
            error: run.error,
            notice: run.notice,
        },
        on: { onText: (value: string) => setText(value), onPaste: paste, onLoad: load },
        templateRead: templatesRead.read,
        retryTemplates: templatesRead.reload,
    } as const
}
