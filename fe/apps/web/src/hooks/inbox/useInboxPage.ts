"use client"

import { usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { useConsoleCrumbs } from "@/hooks/pageCrumbs"
import { useWorkspaceId } from "@/hooks/workspaces"
import { inboxGridOf, ALL_OPTION } from "@/modules/inbox"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { InboxFeedBaseProps } from "@/components/blocks/InboxFeed/component"
import { useInboxActions } from "./useInboxActions"
import { useInboxChoice } from "./useInboxChoice"
import { useInboxDetail } from "./useInboxDetail"
import { useInboxLeads } from "./useInboxLeads"
import { useInboxWords } from "./useInboxWords"
import { useState } from "react"
import { useWebsiteIntake } from "./useWebsiteIntake"

/** The sales workbench: where an order is changed. */
const SALES_WORKBENCH_ROUTE = "/agents/sales/workbench"

/** Everything the inbox page draws and does: the list, the opened customer, the decision, the hand-over and the website drawer. */
export const useInboxPage = (): Pick<InboxFeedBaseProps, "props" | "on"> => {
    const { copy, words } = useInboxWords()
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const phone = usePanePhone()
    const choice = useInboxChoice()
    const [journeyFilter, setJourneyFilter] = useState("all")
    const [isAsideOpen, setAsideOpen] = useState(false)
    const leads = useInboxLeads({ ...choice, selectedId: null }, words)
    const rows = leads.list.rows
    const selectedId = rows.some((row) => row.id === choice.chosen) ? choice.chosen : (rows[0]?.id ?? null)
    const list = { ...leads.list, selectedId }
    const opened = useInboxDetail(selectedId, words)
    const actions = useInboxActions()
    const agents = list.agents.filter((agent) => agent.id !== ALL_OPTION)
    const website = useWebsiteIntake(agents)
    const crumbs = useConsoleCrumbs(copy.title)
    const go = (path: string): void => router.push(workspaceHref(workspaceId, path))
    return {
        props: {
            breadcrumbs: crumbs,
            copy,
            pane: {
                back: pane.backToList,
                refresh: pane.refresh,
                retry: pane.retry,
                clearSearch: pane.clearSearch,
                moreFilters: pane.moreFilters,
                closeAside: pane.closeAside,
            },
            grid: inboxGridOf(phone.phone, selectedId !== null),
            phone: phone.phone,
            isAsideOpen,
            list,
            listStatus: leads.status,
            detail: opened.detail,
            detailStatus: opened.status,
            agents,
            isDeciding: actions.isDeciding,
            decisionFailed: actions.decisionFailed,
            journeyFilter,
            website: website.view,
            websiteFailed: website.failed,
        },
        on: {
            setTab: choice.setTab,
            setQuery: choice.setQuery,
            setChannel: choice.setChannel,
            setAgent: choice.setAgent,
            setSort: choice.setSort,
            select: (id) => {
                choice.choose(id)
                setJourneyFilter("all")
                phone.showMain()
            },
            back: phone.showList,
            openAside: () => setAsideOpen(true),
            closeAside: () => setAsideOpen(false),
            refresh: () => {
                leads.refresh()
                opened.refresh()
            },
            openConnections: () => go(CONSOLE_ROUTES.connections),
            assign: actions.assign,
            message: () => go(CONSOLE_ROUTES.chat),
            copy: (text) => void website.copy(text),
            approve: actions.approve,
            reject: actions.reject,
            edit: () => go(SALES_WORKBENCH_ROUTE),
            setJourneyFilter,
            website: {
                open: website.open,
                close: website.close,
                selectTab: website.selectTab,
                setChat: website.setChat,
                setForm: website.setForm,
                setPrices: website.setPrices,
                setAgent: website.setAgent,
                save: website.save,
            },
        },
    }
}
