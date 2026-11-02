import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import { BrainPageActions } from "@/components/composites/BrainPageActions"
import type { BrainPageHeaderView } from "@/modules/types"

/** The header, with the tabs of the Second Brain, and the body of its page. */
export interface BrainPageFrameBaseProps {
    /** The page body, drawn under the header band in the page measure and gutter. */
    readonly children: ReactNode
    readonly props: BrainPageHeaderView
    readonly on: {
        readonly reviewAll: () => void
        readonly setPart: (id: string) => void
        readonly selectTab: (id: string) => void
    }
}

/**
 * Draws a Second Brain page whose tab sits in the page measure (sources, review, facts, lessons, questions, what each agent
 * sees): its header band with the tabs, then the body. The dossiers tab is panes and draws its own panes page.
 */
export const BrainPageFrameBase = (props: BrainPageFrameBaseProps) => (
    <Page
        header={{
            ...props.props.heading,
            actions: (
                <BrainPageActions {...props.props.actions} onReview={props.on.reviewAll} onSetPart={props.on.setPart} />
            ),
            tabs: {
                label: props.props.tabs.label,
                items: props.props.tabs.items,
                selectedKey: props.props.tabs.selectedKey,
                labelVisibility: "always",
                panelId: (key) => `${props.props.tabs.panelPrefix}${key}`,
                onSelect: props.on.selectTab,
            },
        }}
        measure="product"
    >
        {props.children}
    </Page>
)
