"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useAutomationsBoard } from "@/hooks/automations"
import type { AutomationsData } from "@/hooks/automations"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import type { ModuleScope } from "@/lib/automation-shared"
import { writeAutomation } from "@/modules/db/automations/write-automation"
import { writeAutomationCommand } from "@/modules/db/automations/write-automation-command"
import { AutomationsBoardBase } from "./component"

/** Props for the connected board of automations. */
interface AutomationsBoardProps {
    readonly workspaceId: string
    /** The automations as the page read them; absent while they load. */
    readonly initial?: AutomationsData
    /** "page": filters and a grid with the detail beside it. "module": one module's cards as a compact list, detail below. */
    readonly layout: "page" | "module"
    readonly moduleKey?: ModuleScope
    readonly focus?: string
}

const NOTHING: AutomationsData = { cards: [], runs: [], shop: { shop: "", hours: "", tone: "" }, accounts: [] }

/** The connected board: cards, switches, filters, the detail and the hidden list; every change is written under the owner's RLS. */
export const AutomationsBoard = (props: AutomationsBoardProps) => {
    const t = useTranslations("automations")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const board = useAutomationsBoard({
        workspaceId: props.workspaceId,
        initial: props.initial ?? NOTHING,
        layout: props.layout,
        t,
        locale,
        when: (iso) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }),
        change: writeAutomation,
        command: writeAutomationCommand,
        ...(props.moduleKey === undefined ? {} : { moduleKey: props.moduleKey }),
        ...(props.focus === undefined ? {} : { focus: props.focus }),
    })
    return (
        <AutomationsBoardBase
            props={{
                slot: props.initial === undefined ? loadingSlot() : { items: board.view },
                layout: props.layout,
                labels: {
                    slot: slotLabels(t("emptyAll")),
                    loading: t("loading"),
                    status: t("statusOff"),
                    select: t("selectHint"),
                },
            }}
            on={board.on}
        />
    )
}
