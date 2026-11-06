"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useBrainPageHeader, useBrainQueue, useFactDrawer } from "@/hooks/brain"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainTodoBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page hands the queue: the header without its tabs. */
interface BrainTodoProps {
    readonly header: BrainPageHeading
    /** What the address asks of the fact drawer. */
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The connected queue of what needs doing: the findings of the dossier review, the facts waiting, the customer questions and the
 * proposed public answers, in one work list beside the opened item. Owners and managers answer; everyone reads.
 */
export const BrainTodo = (props: BrainTodoProps) => {
    const q = useTranslations("brainQueue")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const header = useBrainPageHeader("todo", props.header)
    const queue = useBrainQueue()
    const factDrawer = useFactDrawer({ tab: "todo", fact: props.fact, edit: props.edit, answer: props.answer })
    const [isAsideOpen, setAsideOpen] = useState(false)
    return (
        <BrainTodoBase
            props={{
                header: header.props,
                panelId: `${header.props.tabs.panelPrefix}todo`,
                copy: {
                    grid: q("gridLabel"),
                    listLabel: q("listLabel"),
                    detailLabel: q("detailLabel"),
                    asideLabel: q("asideLabel"),
                    searchLabel: q("searchLabel"),
                    clearSearch: pane.clearSearch,
                    filterLabel: q("filterLabel"),
                    pickTitle: q("pickTitle"),
                    pickBody: q("pickBody"),
                    noMatchTitle: pane.noMatchTitle,
                    noMatchBody: pane.noMatchBody,
                    clearFilters: pane.clearFilters,
                    emptyBody: q("emptyBody"),
                    emptyAction: q("emptyAction"),
                    errorBody: q("errorBody"),
                    back: pane.backToList,
                    moreActions: pane.moreActions,
                    loadMore: q("loadMore"),
                    closeAside: pane.closeAside,
                },
                queue: queue.view,
                dialog: queue.dialog,
                factDrawer,
                isAsideOpen,
            }}
            on={{
                reviewAll: header.on.reviewAll,
                selectTab: header.on.selectTab,
                ...queue.on,
                openSources: () => router.push(workspaceHref(workspaceId, brainTabHref("sources"))),
                asideOpenChange: setAsideOpen,
            }}
        />
    )
}
