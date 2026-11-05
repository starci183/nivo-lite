"use client"

import { useTranslations } from "next-intl"
import { useBrainLessons } from "@/hooks/brain"
import { usePaneCopy } from "@/hooks/paneFrame"
import type { BrainPageHeading } from "@/modules/types"
import { BrainLessonsBase } from "./component"

/** What the page hands the lessons tab: the header without its tabs, and whether the address opens the lesson drawer. */
interface BrainLessonsProps {
    readonly header: BrainPageHeading
    readonly lesson: string | undefined
}

/**
 * The connected lessons tab: how each agent should work, learnt from the owner's corrections, beside the opened lesson and the
 * decision about it. Owners and managers study the corrections, write a lesson and decide; everyone reads.
 */
export const BrainLessons = (props: BrainLessonsProps) => {
    const l = useTranslations("brainLessons")
    const pane = usePaneCopy()
    const page = useBrainLessons({ heading: props.header, lesson: props.lesson })
    return (
        <BrainLessonsBase
            props={{
                header: page.header,
                panelId: `${page.header.tabs.panelPrefix}lessons`,
                copy: {
                    grid: l("gridLabel"),
                    listLabel: l("listLabel"),
                    detailLabel: l("detailLabel"),
                    filterLabel: l("filterLabel"),
                    moreFilters: String(l.raw("moreFilters")),
                    pickTitle: l("pickTitle"),
                    pickBody: l("pickBody"),
                    noMatchTitle: pane.noMatchTitle,
                    noMatchBody: pane.noMatchBody,
                    clearFilters: pane.clearFilters,
                    emptyBody: l("emptyBody"),
                    emptyAction: l("emptyAction"),
                    errorBody: l("errorBody"),
                    back: pane.backToList,
                },
                lessons: page.view,
                drawer: page.drawer,
            }}
            on={page.on}
        />
    )
}
