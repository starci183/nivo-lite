"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useInventoryRun } from "@/hooks/inventory"
import { useInventoryStockCommands } from "@/hooks/inventoryCommands"
import { useInventoryTemplates } from "@/hooks/inventoryStarter"

/** The import tab: the pasted text lives here, the drawing in the pure half. */
export const useInventoryImportView = (input: InventoryPanelInput) => {
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
