"use client"

import { useEffect, useState } from "react"
import { useMutateAuthorizeGoogleSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAuthorizeGoogleSwr"
import {
    automationBoardOf,
    automationFiltersFor,
    automationScopeOf,
    automationStatusOf,
    matchesAutomationFilter,
    startsAutomationConnection,
    visibleAutomations,
} from "@/modules/automations"
import type { AutomationFilterKey, AutomationStatus } from "@/modules/automations"
import { isForbiddenFailure } from "@/modules/api"
import { navigation } from "@/modules/i18n"
import { automationFocusPath } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AutomationCardView, AutomationsBoardView } from "@/modules/types"
import { CONNECTION_ROUTE } from "./automations.shared"
import type { AutomationPatch, AutomationsBoardActions, AutomationsBoardInput } from "./automations.shared"
import { useAutomationDetail } from "./useAutomationDetail"
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
    const [filter, setFilter] = useState<AutomationFilterKey>("all")
    const [selected, setSelected] = useState<string | null>(input.focus ?? null)
    const [awaiting, setAwaiting] = useState<string | null>(null)
    const isNested = input.layout === "module"
    const cards = automations.data?.cards ?? []

    const scoped = cards.filter((card) => (input.moduleKey ? automationScopeOf(card.def) === input.moduleKey : true))
    const visible = visibleAutomations(scoped)
    const shown = visible.filter((card) => matchesAutomationFilter(card, filter))
    const current = visible.find((card) => card.key === selected) ?? null
    const detail = useAutomationDetail(current)

    useEffect(() => {
        if (selected)
            document.getElementById("automation-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, [selected])

    const change = (key: string, patch: AutomationPatch) => automations.apply(key, patch)

    const open = (card: AutomationCardView) => {
        setSelected(card.key)
        if (card.body === null && card.def.defaultBody !== null) detail.compose(card.key)
    }

    const select = (key: string) => {
        setAwaiting(null)
        const card = cards.find((candidate) => candidate.key === key)
        if (selected === key || card === undefined) return setSelected(null)
        open(card)
    }

    const connect = async (card: AutomationCardView, status: AutomationStatus) => {
        const route = CONNECTION_ROUTE[status]
        if (route !== undefined) return router.push(route)
        const started = await runGraphQL(() => authorize.trigger({ returnTo: automationFocusPath(card.key) }), {
            showSuccessToast: false,
        })
        if (started !== undefined) window.location.assign(started.url)
    }

    const toggle = (key: string, next: boolean) => {
        const card = cards.find((candidate) => candidate.key === key)
        if (card === undefined) return
        const status = automationStatusOf(card)
        if (startsAutomationConnection(status)) return void connect(card, status)
        if (next && card.def.defaultBody && card.body === null) {
            open(card)
            return setAwaiting(card.key)
        }
        void change(card.key, { enabled: next })
    }

    const saveBody = async (): Promise<boolean> =>
        current === null ? false : change(current.key, { body: detail.form.body })

    const enable = async () => {
        if (current === null || !(await saveBody())) return
        setAwaiting(null)
        await change(current.key, { enabled: true })
    }

    const saveSettings = async () => {
        if (current === null) return
        detail.markSaved(await change(current.key, { values: detail.form.values }))
    }

    const view =
        automations.data === undefined
            ? undefined
            : automationBoardOf({
                  t,
                  locale,
                  when: input.when,
                  isNested,
                  cards,
                  scoped,
                  shown,
                  filter,
                  selected,
                  busyKey: automations.busyKey,
                  accounts: automations.data.accounts,
                  runs: automations.data.runs,
                  shop: automations.data.shop,
                  sample: automations.data.sample,
                  current,
                  errorText: undefined,
                  open: {
                      values: detail.form.values,
                      body: detail.form.body,
                      note: detail.form.note,
                      isComposing: detail.work.isComposing,
                      isStarting: detail.work.isStarting,
                      isStarted: detail.work.isStarted,
                      isSaved: detail.form.isSaved,
                      isAwaiting: current !== null && awaiting === current.key && current.body === null,
                  },
              })
    const filters = automationFiltersFor(cards)

    const on: AutomationsBoardActions = {
        select,
        toggle,
        setFilter: (id) => {
            const next = filters.find((key) => key === id)
            if (next !== undefined) setFilter(next)
        },
        close: () => setSelected(null),
        dismissError: () => undefined,
        restore: (key) => void change(key, { dismissed: false }),
        pickAccount: (key, connectionId) => void change(key, { googleConnectionId: connectionId }),
        dismiss: () => {
            if (current !== null) void change(current.key, { dismissed: true }).then((ok) => ok && setSelected(null))
        },
        changeSetting: detail.changeValue,
        saveSettings: () => void saveSettings(),
        changeBody: detail.editBody,
        enable: () => void enable(),
        saveBody: () => void saveBody(),
        compose: () => detail.compose(),
        answerTrust: (accept) => {
            if (current !== null) void change(current.key, { autoSend: accept })
        },
        runNow: detail.startRun,
    }
    return {
        view,
        on,
        isLoading: automations.isLoading,
        error: automations.error,
        isForbidden: isForbiddenFailure(automations.error),
    }
}
