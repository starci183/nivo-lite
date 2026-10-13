import { useEffect, useState } from "react"
import type { AutomationCardView } from "@/lib/automation-shared"
import { startGoogleConnect } from "@/lib/google-actions"
import {
    automationBoardOf,
    automationFaultText,
    automationFiltersFor,
    automationScopeOf,
    automationStatusOf,
    matchesAutomationFilter,
    startsAutomationConnection,
    visibleAutomations,
} from "@/modules/automations"
import type { AutomationFilterKey, AutomationStatus } from "@/modules/automations"
import type { AutomationsBoardView } from "@/modules/types"
import { navigation } from "@/modules/i18n"
import { automationFocusPath } from "@/modules/routes"
import { CONNECTION_ROUTE } from "./automations.shared"
import type { AutomationPatch, AutomationsBoardActions, AutomationsBoardInput } from "./automations.shared"
import { useAutomationDetail } from "./useAutomationDetail"
import type { CommandAction } from "./useAutomationDetail"
import { useAutomations } from "./useAutomations"

const { useRouter } = navigation

/** The board of automations: what it draws, and every change the owner can make. */
export const useAutomationsBoard = (
    input: AutomationsBoardInput,
): { readonly view: AutomationsBoardView; readonly on: AutomationsBoardActions } => {
    const { t, locale, workspaceId } = input
    const router = useRouter()
    const data = useAutomations(input.initial.cards)
    const [filter, setFilter] = useState<AutomationFilterKey>("all")
    const [selected, setSelected] = useState<string | null>(input.focus ?? null)
    const [awaiting, setAwaiting] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | undefined>(undefined)
    const isNested = input.layout === "module"

    const scoped = data.cards.filter((card) =>
        input.moduleKey ? automationScopeOf(card.def) === input.moduleKey : true,
    )
    const visible = visibleAutomations(scoped)
    const shown = visible.filter((card) => matchesAutomationFilter(card, filter))
    const current = visible.find((card) => card.key === selected) ?? null
    const command: CommandAction = (kind, templateKey) => input.command({ workspaceId, kind, templateKey })
    const detail = useAutomationDetail(current, command, data.setFailure)

    useEffect(() => {
        if (selected)
            document.getElementById("automation-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, [selected])

    const change = (key: string, patch: AutomationPatch) =>
        data.apply(key, () => input.change({ workspaceId, templateKey: key, patch }))

    const open = (card: AutomationCardView) => {
        data.setFailure(null)
        setNotice(undefined)
        setSelected(card.key)
        if (card.body === null && card.def.defaultBody !== null) detail.compose(card.key)
    }

    const select = (key: string) => {
        data.setFailure(null)
        setAwaiting(null)
        const card = data.cards.find((candidate) => candidate.key === key)
        if (selected === key || card === undefined) return setSelected(null)
        open(card)
    }

    const connect = async (card: AutomationCardView, status: AutomationStatus) => {
        const route = CONNECTION_ROUTE[status]
        if (route !== undefined) return router.push(route)
        const started = await startGoogleConnect(automationFocusPath(card.key))
        if (started.ok) return window.location.assign(started.data.url)
        setNotice(started.error)
    }

    const toggle = (key: string, next: boolean) => {
        const card = data.cards.find((candidate) => candidate.key === key)
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

    const failure = data.failure === null ? undefined : automationFaultText(t, data.failure)
    const view = automationBoardOf({
        t,
        locale,
        when: input.when,
        isNested,
        cards: data.cards,
        scoped,
        shown,
        filter,
        selected,
        busyKey: data.busyKey,
        accounts: input.initial.accounts,
        runs: input.initial.runs,
        shop: input.initial.shop,
        current,
        errorText: notice ?? failure,
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
    const filters = automationFiltersFor(data.cards)

    const on: AutomationsBoardActions = {
        select,
        toggle,
        setFilter: (id) => {
            const next = filters.find((key) => key === id)
            if (next !== undefined) setFilter(next)
        },
        close: () => setSelected(null),
        dismissError: () => {
            data.setFailure(null)
            setNotice(undefined)
        },
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
    return { view, on }
}
