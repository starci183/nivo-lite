"use client"

import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { slotOfReads } from "@/hooks/slot"
import { noData } from "@/hooks/workspaceread"
import {
    automationBoardOf,
    automationFiltersFor,
    automationScopeOf,
    visibleAutomations,
    hiddenAutomations,
} from "@/modules/automations"
import { pickCopy } from "@/modules/catalog"
import type { AutomationsBoardView, DataSlot } from "@/modules/types"
import { useState } from "react"
import { automationBoardActionsOf, automationBoardInputOf, automationShownOf } from "./automations.shared"
import type { AutomationPatch, AutomationsBoardActions, AutomationsBoardInput } from "./automations.shared"
import { useAutomationConnect } from "./useAutomationConnect"
import { useAutomationSelection } from "./useAutomationSelection"
import { useAutomations } from "./useAutomations"

/** What the board hook answers: the view model when the data is there, the actions, and how the read went. */
export interface AutomationsBoardState {
    readonly slot: DataSlot<AutomationsBoardView>
    readonly on: AutomationsBoardActions
    readonly retry: () => void
}

/** The board of automations: the gallery from the back end through SWR, and every change the owner can make. */
export const useAutomationsBoard = (input: AutomationsBoardInput): AutomationsBoardState => {
    const { t, locale } = input
    const connect = useAutomationConnect()
    const automations = useAutomations()
    const catalog = useModuleCatalog()
    const moduleNames = Object.fromEntries(
        Object.entries(catalog.modules).map(([key, module]) => [key, pickCopy(module.name, locale)]),
    )
    const [filter, setFilter] = useState<string>("all")
    const isNested = input.layout === "module"
    const cards = automations.data?.cards ?? []

    const scoped = cards.filter((card) => (input.moduleKey ? automationScopeOf(card.def) === input.moduleKey : true))
    const visible = visibleAutomations(scoped)
    const hiddenCards = hiddenAutomations(scoped)
    const shown = automationShownOf(visible, hiddenCards, filter)
    const change = (key: string, patch: AutomationPatch) => automations.apply(key, patch)

    const { selected, awaiting, current, detail, select, toggle, saveBody, enable, saveSettings, setSelected } =
        useAutomationSelection({
            focus: input.focus ?? null,
            cards,
            visible: [...visible, ...hiddenCards],
            change,
            connect,
        })

    const slot = slotOfReads([automations.reads.overview, automations.reads.accounts, catalog.read], () => {
        const data = automations.data ?? noData("automations")
        return automationBoardOf(
            automationBoardInputOf({
                t,
                locale,
                moduleNames,
                input,
                isNested,
                cards,
                scoped,
                shown,
                filter,
                selected,
                data,
                busyKey: automations.busyKey,
                current,
                detail,
                awaiting,
            }),
        )
    })
    const filters = automationFiltersFor(cards)

    const on: AutomationsBoardActions = automationBoardActionsOf({
        select,
        toggle,
        filters,
        setFilter,
        setSelected,
        change,
        current,
        detail,
        saveSettings,
        saveBody,
        enable,
    })
    return {
        slot,
        on,
        retry: () => {
            automations.retry()
            catalog.reload()
        },
    }
}
