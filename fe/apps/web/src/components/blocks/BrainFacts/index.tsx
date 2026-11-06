"use client"

import { useTranslations } from "next-intl"
import { useBrainFacts } from "@/hooks/brain"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainFactsBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page hands the facts tab: the header without its tabs, and what the address asks of the fact drawer. */
interface BrainFactsProps {
    readonly header: BrainPageHeading
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The connected facts tab: the facts in force and the scheduled ones beside the opened fact, with a new value and a stop that asks
 * first. Owners and managers write; everyone reads.
 */
export const BrainFacts = (props: BrainFactsProps) => {
    const f = useTranslations("brainFacts")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const page = useBrainFacts({ heading: props.header, fact: props.fact, edit: props.edit, answer: props.answer })
    return (
        <BrainFactsBase
            props={{
                header: page.header,
                panelId: `${page.header.tabs.panelPrefix}facts`,
                copy: {
                    grid: f("gridLabel"),
                    listLabel: f("listLabel"),
                    detailLabel: f("detailLabel"),
                    searchLabel: f("searchLabel"),
                    clearSearch: pane.clearSearch,
                    filterLabel: f("filterLabel"),
                    moreFilters: String(f.raw("moreFilters")),
                    pickTitle: f("pickTitle"),
                    pickBody: f("pickBody"),
                    noMatchTitle: pane.noMatchTitle,
                    noMatchBody: pane.noMatchBody,
                    clearFilters: pane.clearFilters,
                    emptyBody: f("emptyBody"),
                    emptyAction: f("emptyAction"),
                    errorBody: f("errorBody"),
                    back: pane.backToList,
                },
                facts: page.view,
                factDrawer: page.drawer,
            }}
            on={{
                ...page.on,
                add: () => router.push(workspaceHref(workspaceId, brainTabHref("facts", { fact: "new" }))),
            }}
        />
    )
}
