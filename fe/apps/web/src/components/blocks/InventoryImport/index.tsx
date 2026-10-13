"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useInventoryRun } from "@/hooks/inventory"
import { useInventoryStockCommands } from "@/hooks/inventoryCommands"
import { useInventoryTemplates } from "@/hooks/inventoryStarter"
import { InventoryImportBase } from "./component"

/** Whether the person may import. */
interface InventoryImportProps {
    readonly canManage: boolean
}

/** The import tab: the pasted text lives here, the drawing in the pure half. */
export const InventoryImport = (props: InventoryImportProps) => {
    const t = useTranslations("workbenchInventory")
    const commands = useInventoryStockCommands()
    const { templates } = useInventoryTemplates()
    const run = useInventoryRun()
    const [text, setText] = useState("")
    const paste = () =>
        run.exec(
            () => commands.importPaste(text),
            (result) => {
                setText("")
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
    return (
        <InventoryImportBase
            props={{
                allowed: props.canManage,
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
            }}
            on={{ text: setText, paste, load }}
        />
    )
}
