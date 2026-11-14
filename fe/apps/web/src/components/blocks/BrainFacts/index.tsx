"use client"

import { useTranslations } from "next-intl"
import { useBrainFacts, useBrainKnowledgeHeader } from "@/hooks/brain"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import type { BrainPageHeading } from "@/modules/types"
import { BrainFactsBase } from "./component"

/** What the page hands the facts chip: the header without its tabs, and what the address asks of the fact drawer. */
interface BrainFactsProps {
    readonly header: BrainPageHeading
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The connected facts chip of the knowledge tab: every fact, waiting or in use, grouped by subject with ticks to approve them together,
 * the detail of one fact and the comparison of a conflict in drawers. Owners and managers decide; everyone reads.
 */
export const BrainFacts = (props: BrainFactsProps) => {
    const t = useTranslations("brainInbox")
    const f = useTranslations("brainFacts")
    const m = useTranslations("brainFactMap")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const header = useBrainKnowledgeHeader("facts", props.header)
    const page = useBrainFacts({ fact: props.fact, edit: props.edit, answer: props.answer })
    return (
        <BrainFactsBase
            props={{
                header: header.props,
                slot: page.slot,
                labels: { ...slotLabels(f("emptyTitle")), error: f("errorTitle") },
                copy: page.copy,
                words: {
                    statusLabel: t("statusFilterLabel"),
                    searchLabel: t("factsSearch"),
                    clearSearch: pane.clearSearch,
                    groupingLabel: t("groupingLabel"),
                    bySubject: t("bySubject"),
                    byDocument: t("byDocument"),
                    errorBody: f("errorBody"),
                },
                pager: page.pager,
                paging: page.paging,
                count: page.count,
                status: page.filters.status,
                selectedStatus: page.filters.selected,
                query: page.filters.query,
                grouping: page.filters.grouping,
                canWrite: page.canWrite,
                maintain: page.maintain,
                bar: page.pick.bar,
                confirm: page.pick.confirm,
                conflict: page.conflict.view,
                detail: page.detail.view,
                factDrawer: page.drawer,
                card: {
                    title: m("cardTitle"),
                    modeLabel: m("modeLabel"),
                    modeList: m("modeList"),
                    modeMap: m("modeMap"),
                },
                mode: page.map.mode,
                map: page.map.view,
            }}
            on={{
                selectTab: header.on.selectTab,
                ...page.on,
                ...page.pick.on,
                setMode: page.map.on.setMode,
                map: {
                    setView: page.map.on.setView,
                    select: page.map.on.select,
                    approve: page.map.on.approve,
                    edit: page.map.on.edit,
                    compare: page.map.on.compare,
                },
                open: page.detail.on.open,
                closeDetail: page.detail.on.close,
                edit: page.detail.on.edit,
                approve: page.detail.on.approve,
                reject: page.detail.on.reject,
                menu: page.detail.on.menu,
                confirmRetire: page.detail.on.confirmRetire,
                cancelRetire: page.detail.on.cancelRetire,
                compare: page.conflict.on.open,
                closeConflict: page.conflict.on.close,
                choose: page.conflict.on.choose,
                confirmChoice: page.conflict.on.confirm,
            }}
        />
    )
}
