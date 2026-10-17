"use client"

import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { useMutateAuthorizeGoogleSwr } from "@/hooks/swr"
import { isForbiddenFailure } from "@/modules/failure"
import {
    automationBoardOf,
    automationFiltersFor,
    automationScopeOf,
    matchesAutomationFilter,
    visibleAutomations,
} from "@/modules/automations"
import type { AutomationFilterKey, AutomationStatus } from "@/modules/automations"
import { pickCopy } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { automationFocusPath } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AutomationCardView, AutomationsBoardView } from "@/modules/types"
import { useState } from "react"
import { automationBoardActionsOf, automationBoardInputOf, CONNECTION_ROUTE } from "./automations.shared"
import type { AutomationPatch, AutomationsBoardActions, AutomationsBoardInput } from "./automations.shared"
import { useAutomationSelection } from "./useAutomationSelection"
import { useAutomations } from "./useAutomations"

/** What the board hook answers: the view model when the data is there, the actions, and how the read went. */
export interface AutomationsBoardState {
    readonly view: AutomationsBoardView | undefined
    readonly on: AutomationsBoardActions
    readonly isLoading: boolean
    readonly error: unknown
    /** True when the member may not manage automations (the back end refused with `forbidden`). */
    readonly isForbidden: boolean
}

/** The board of automations: the gallery from the back end through SWR, and every change the owner can make. */
export const useAutomationsBoard = (input: AutomationsBoardInput): AutomationsBoardState => {
    const { t, locale } = input
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const authorize = useMutateAuthorizeGoogleSwr()
    const automations = useAutomations()
    const catalog = useModuleCatalog()
    const moduleNames = Object.fromEntries(
        Object.entries(catalog.modules).map(([key, module]) => [key, pickCopy(module.name, locale)]),
    )
    const [filter, setFilter] = useState<AutomationFilterKey>("all")
    const isNested = input.layout === "module"
    const cards = automations.data?.cards ?? []

    const scoped = cards.filter((card) => (input.moduleKey ? automationScopeOf(card.def) === input.moduleKey : true))
    const visible = visibleAutomations(scoped)
    const shown = visible.filter((card) => matchesAutomationFilter(card, filter))
    const change = (key: string, patch: AutomationPatch) => automations.apply(key, patch)

    const connect = async (card: AutomationCardView, status: AutomationStatus) => {
        const route = CONNECTION_ROUTE[status]
        if (route !== undefined) return router.push(route)
        const started = await runGraphQL(() => authorize.trigger({ returnTo: automationFocusPath(card.key) }), {
            showSuccessToast: false,
        })
        if (started !== undefined) window.location.assign(started.url)
    }

    const { selected, awaiting, current, detail, select, toggle, saveBody, enable, saveSettings, setSelected } =
        useAutomationSelection({ focus: input.focus ?? null, cards, visible, change, connect })

    const view =
        automations.data === undefined || catalog.slot.items === undefined
            ? undefined
            : automationBoardOf(
                  automationBoardInputOf(
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
                      automations.data,
                      automations.busyKey,
                      current,
                      detail,
                      awaiting,
                  ),
              )
    const filters = automationFiltersFor(cards)

    const on: AutomationsBoardActions = automationBoardActionsOf(
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
    )
    return {
        view,
        on,
        isLoading: automations.isLoading || catalog.slot.isLoading === true,
        error: automations.error ?? catalog.error,
        isForbidden: isForbiddenFailure(automations.error),
    }
}
