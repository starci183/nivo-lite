"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useQueryContactMessagesSwr } from "@/hooks/swr"
import { isModuleKey } from "@/modules/catalog"
import {
    HISTORY_ALL_KEY,
    historyLinesOf,
    historyTabsOf,
    orderViewOf,
    routeOfTab,
    type ContactDetailWire,
    type ContactLineWire,
    type ContactRouteWire,
} from "@/modules/contacts"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import type {
    ContactHistoryLineView,
    ContactHistoryThread,
    ContactHistoryView,
    ContactHistoryWords,
    DataSlot,
} from "@/modules/types"

/** No line read yet. */
const NO_ROWS: ReadonlyArray<ContactLineWire> = []

/** What the history of a person is read for. */
interface ContactHistoryInput {
    readonly workspaceId: string
    /** The person the address names: none on the list itself, undefined on the loading page of a person. */
    readonly contactId: string | null | undefined
    /** Whether the viewer may read people at all. */
    readonly enabled: boolean
    /** The person's detail once read: its routes are the tabs; until then the block is loading, not empty. */
    readonly detail: ContactDetailWire | undefined
}

/** What the conversation block draws and does. */
export interface ContactHistory {
    readonly view: ContactHistoryView | null
    readonly selectTab: (key: string) => void
    readonly older: () => void
    readonly retry: () => void
}

/** The words of the lines: who spoke (the name the server gives, else a plain word), the day and the time, in the language of the page. */
const useHistoryWords = (): ContactHistoryWords => {
    const t = useTranslations("contacts")
    const format = useFormatter()
    return useMemo(() => {
        const now = new Date()
        const dayOf = (at: Date): string => {
            const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000)
            if (days === 0) return t("historyToday")
            if (days === 1) return t("historyYesterday")
            return format.dateTime(at, { day: "numeric", month: "numeric", year: "numeric" })
        }
        return {
            person: t("historyPerson"),
            agent: (name) => t("historyAgent", { name: name ?? t("historyAgentName") }),
            staff: (name) => t("historyStaff", { name: name ?? t("historyStaffName") }),
            day: (iso, channel) =>
                channel === null ? dayOf(new Date(iso)) : t("historyDay", { day: dayOf(new Date(iso)), channel }),
            time: (iso) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" }),
            order: (orderJson) =>
                orderViewOf(orderJson, {
                    total: t("historyOrderTotal"),
                    deliver: t("historyOrderDeliver"),
                    paid: t("historyOrderPaid"),
                    pending: t("historyOrderPending"),
                }),
        }
    }, [t, format])
}

/** Midnight of the day of an instant, in milliseconds. */
const startOfDay = (at: Date): number => new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()

/** The thread as a data slot: nothing to read, the read failed, still loading, nothing said yet, or the lines so far. */
const threadSlotOf = (
    read: ReturnType<typeof useQueryContactMessagesSwr>,
    hasRoutes: boolean,
    lines: ReadonlyArray<ContactHistoryLineView>,
): DataSlot<ContactHistoryThread> => {
    if (!hasRoutes) return { isEmpty: true }
    if (read.error !== undefined && read.data === undefined) return { isError: true }
    if (read.data === undefined) return { isLoading: true }
    if (lines.length === 0) return { isEmpty: true }
    return {
        items: {
            lines,
            hasOlder: (read.data.at(-1)?.next ?? null) !== null,
            isLoadingOlder: read.size > read.data.length,
        },
    }
}

/** The workbench of the agent that spoke last on a route (`/agents/<module>/<installation>/workbench`); null when no agent has spoken there. */
const workbenchHrefOf = (workspaceId: string, route: ContactRouteWire | undefined): string | null => {
    const workbench = route?.workbench
    if (workbench === undefined || workbench === null || !isModuleKey(workbench.moduleKey)) return null
    return workspaceHref(workspaceId, agentHref(workbench.moduleKey, workbench.installationId, "workbench"))
}

/**
 * The conversation of the open person across every channel (`contactMessages`, one merged read, read only): the tab is the filter of
 * the block ("all" reads every route; a route's tab passes that route's id), "older" asks the next page by the server's cursor. The
 * workbench link follows the tab: the route's own, or on "all" the most recently active route's.
 */
export const useContactHistory = (input: ContactHistoryInput): ContactHistory => {
    const t = useTranslations("contacts")
    const words = useHistoryWords()
    const [chosen, setChosen] = useState<{ readonly contactId: string; readonly key: string } | null>(null)
    const openId = typeof input.contactId === "string" ? input.contactId : null
    const routes = input.detail?.routes
    const wanted = chosen !== null && chosen.contactId === openId ? chosen.key : HISTORY_ALL_KEY
    const route = routes === undefined ? null : routeOfTab(routes, wanted)
    const key = route === null ? HISTORY_ALL_KEY : wanted
    const read = useQueryContactMessagesSwr(
        input.enabled && openId !== null ? input.workspaceId : undefined,
        openId ?? undefined,
        route?.routeId ?? null,
    )
    const rows = useMemo(
        () => (read.data === undefined ? NO_ROWS : read.data.flatMap((page) => page.rows)),
        [read.data],
    )
    const lines = useMemo(() => historyLinesOf(rows, words, key === HISTORY_ALL_KEY), [rows, words, key])
    const thread: DataSlot<ContactHistoryThread> =
        routes === undefined ? { isLoading: true } : threadSlotOf(read, routes.length > 0, lines)
    return {
        view:
            input.contactId === null
                ? null
                : {
                      tabs: historyTabsOf(routes ?? [], t("historyTabAll")),
                      selectedKey: key,
                      workbenchHref: workbenchHrefOf(input.workspaceId, route ?? routes?.[0]),
                      thread,
                  },
        selectTab: (next) => {
            if (openId !== null) setChosen({ contactId: openId, key: next })
        },
        older: () => void read.setSize((size) => size + 1),
        retry: () => void read.mutate(),
    }
}
