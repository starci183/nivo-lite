"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useInventoryRun } from "@/hooks/inventory"
import { TEMPLATE_CHOICES, starterOf } from "@/hooks/inventoryStarter"
import { useInventoryCommands } from "@/hooks/inventoryCommands"
import { writeInventoryCommand } from "@/modules/db/inventory/write-inventory-command"
import { InventoryImportBase } from "./component"

/** Whether the person may import, and the workspace. */
interface InventoryImportProps {
    readonly canManage: boolean
    readonly workspaceId: string
}

/** The import tab: the pasted text lives here, the drawing in the pure half. */
export const InventoryImport = (props: InventoryImportProps) => {
    const t = useTranslations("workbenchInventory")
    const commands = useInventoryCommands(props.workspaceId, writeInventoryCommand)
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
    const load = (key: string) => {
        const starter = starterOf(key)
        if (starter === null) return
        run.exec(
            () => commands.applyStarter(starter),
            (result) => t("starterDone", { items: result.items, suppliers: result.suppliers, recipes: result.recipes }),
        )
    }
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
                templates: TEMPLATE_CHOICES,
                isPending: run.isPending,
                error: run.error,
                notice: run.notice,
            }}
            on={{ text: setText, paste, load }}
        />
    )
}
