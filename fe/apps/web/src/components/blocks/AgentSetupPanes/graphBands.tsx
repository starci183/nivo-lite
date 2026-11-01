import { Drawer } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentGraphAdder } from "@/components/branches/AgentGraphAdder"
import { AgentGraphBranches } from "@/components/branches/AgentGraphBranches"
import { AgentGraphProblems } from "@/components/branches/AgentGraphProblems"
import { AgentGraphCanvas } from "@/components/composites/AgentGraphCanvas"
import { AgentGraphHead } from "@/components/composites/AgentGraphHead"
import { AgentGraphMode } from "@/components/composites/AgentGraphMode"
import { AgentGraphInspector } from "@/components/composites/AgentGraphInspector"
import { AgentGraphTabs } from "@/components/composites/AgentGraphTabs"
import { SlotView } from "@/components/composites/SlotView"
import type {
    AgentGraphAction,
    AgentGraphPanelView,
    AgentGraphSideTab,
    DataSlot,
    SlotLabels,
} from "@/modules/types"

/** What the bands of the work map need of the panes: the graph read, its words, and the commands on it. */
export interface GraphBandProps {
    readonly props: {
        readonly graph: DataSlot<AgentGraphPanelView>
        readonly graphPlaceholder: AgentGraphPanelView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly graph: (action: AgentGraphAction) => void
        readonly retryGraph: () => void
        readonly open: (href: string) => void
    }
}

/** The props of the phone list of branches. */
export interface BranchesBandProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** The props of the band that says what is wrong with the draft. */
export interface ProblemsBandProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** The props of the head of the work map. */
export interface GraphHeadBandProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** The props of the switch beside the map. */
export interface GraphModeBandProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** The props of the graph itself. */
export interface GraphCanvasBandProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** The props of the drawer that holds the detail of a node on a phone. */
export interface DetailDrawerProps {
    readonly props: GraphBandProps["props"]
    readonly on: GraphBandProps["on"]
}

/** Draws a read through the one recipe of a slot's status. */
const viewOf = (props: GraphBandProps, render: (data: AgentGraphPanelView, isSkeleton: boolean) => ReactNode) => (
    <SlotView
        slot={props.props.graph}
        placeholder={props.props.graphPlaceholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retryGraph}
    >
        {render}
    </SlotView>
)

/** The phone list of branches, each one a sentence, with the way to add a decision point to an agent that has none. */
export const BranchesBand = (props: BranchesBandProps) =>
    viewOf(props, (view, isSkeleton) => (
        <>
            <AgentGraphBranches
                view={view.branches}
                isSkeleton={isSkeleton}
                onOpen={(value) => props.on.graph({ kind: "openNode", value })}
            />
            <AgentGraphAdder
                view={view.adder}
                isSkeleton={isSkeleton}
                onPick={(field, value) => props.on.graph({ kind: "adderPick", field, value })}
                onAdd={(action, fact) => props.on.graph({ kind: "addDecide", action, fact })}
            />
        </>
    ))
/** What is wrong with the draft, in words, with the step to open and the page where a right is given. */
export const ProblemsBand = (props: ProblemsBandProps) =>
    viewOf(props, (view, isSkeleton) =>
        isSkeleton ? null : (
            <AgentGraphProblems
                view={view.problems}
                onOpen={(value) => props.on.graph({ kind: "openNode", value })}
                onGrants={() => props.on.open("/authority")}
            />
        ),
    )
/** The head of the work map. */
export const GraphHeadBand = (props: GraphHeadBandProps) =>
    viewOf(props, (view, isSkeleton) => (
        <AgentGraphHead
            view={view.head}
            isSkeleton={isSkeleton}
            onPublish={() => props.on.graph({ kind: "publish" })}
        />
    ))
/** The switch beside the map: does the agent work by the map or only record it. */
export const GraphModeBand = (props: GraphModeBandProps) =>
    viewOf(props, (view, isSkeleton) => (
        <AgentGraphMode
            view={view.mode}
            isSkeleton={isSkeleton}
            onMode={(value) => props.on.graph({ kind: "mode", value })}
        />
    ))
/** The graph itself. */
export const GraphCanvasBand = (props: GraphCanvasBandProps) =>
    viewOf(props, (view, isSkeleton) => (
        <AgentGraphCanvas
            view={view.canvas}
            isSkeleton={isSkeleton}
            onSelect={(value) => props.on.graph({ kind: value === "" ? "select" : "openNode", value })}
        />
    ))
/** Whether the tab line is the switch of the phone. */
export interface TabsBandProps extends GraphBandProps {
    readonly isPhone: boolean
}
/** The tab line of the pane beside the graph, or the switch of the phone. */
export const TabsBand = (props: TabsBandProps) =>
    viewOf(props, (view) => (
        <AgentGraphTabs
            label={props.isPhone ? view.phoneLabel : view.tabsLabel}
            tabs={props.isPhone ? view.phoneOptions : view.tabs}
            selected={props.isPhone ? view.phoneView : view.sideTab}
            isSwitch={props.isPhone}
            onSelect={(value) => props.on.graph({ kind: props.isPhone ? "phoneView" : "sideTab", value })}
        />
    ))
/** The tab that is not the chat, in the pane beside the graph or, on a phone, in the drawer: detail, proposals or versions. */
export interface InspectorBandProps extends GraphBandProps {
    readonly sideTab: AgentGraphSideTab
}
/** The body of the pane beside the graph for a tab that is not the chat. */
export const InspectorBand = (props: InspectorBandProps) =>
    viewOf(props, (view, isSkeleton) => (
        <AgentGraphInspector view={view} sideTab={props.sideTab} isSkeleton={isSkeleton} onAction={props.on.graph} />
    ))
/** The drawer that holds the detail of a node on a phone. */
export const DetailDrawer = (props: DetailDrawerProps) =>
    viewOf(props, (view, isSkeleton) => (
        <Drawer
            title={view.drawerTitle}
            isOpen={view.isDrawerOpen}
            onOpenChange={() => props.on.graph({ kind: "closeDrawer" })}
        >
            <AgentGraphInspector view={view} sideTab="detail" isSkeleton={isSkeleton} onAction={props.on.graph} />
        </Drawer>
    ))
