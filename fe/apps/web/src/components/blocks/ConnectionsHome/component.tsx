import { EmptyNotice, Stack, SurfaceCard, type Figure } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionsListView } from "@/modules/types"
import { AttentionSection } from "./attention"
import { ConnectionsTable } from "./table"
import type { ConnectionsHomeBaseProps, ConnectionsHomeCopy } from "./types"

export type { ConnectionsHomeBaseProps } from "./types"

/** The geometry of a ready page: the figures and five rows keep their cells while the read waits. */
const PLACEHOLDER: ConnectionsListView = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({
        id,
        name: "",
        description: "",
        logo: { isWordmark: false },
        status: { label: "", tone: "neutral" as const, isDot: false },
        href: "",
        groups: [],
        lastEventAt: null,
        isFailed: false,
        agents: "",
    })),
    filters: [{ value: "all", label: "", count: 0 }],
    summary: "",
    liveCount: 1,
    attention: [],
    figures: { total: 0, running: 0, waiting: 0, attention: 0, agentsUsing: 0, agentsTotal: 0 },
    canManage: false,
}

/** The four health figures: what runs, what waits for its first event, what needs the owner, and the agents that use a connection. */
const figuresOf = (copy: ConnectionsHomeCopy, view: ConnectionsListView): ReadonlyArray<Figure> => [
    { id: "running", term: copy.running, value: view.figures.running, meta: copy.runningMeta },
    { id: "waiting", term: copy.waiting, value: view.figures.waiting, meta: copy.waitingMeta },
    { id: "needs", term: copy.needs, value: view.figures.attention, meta: copy.needsMeta },
    { id: "agents", term: copy.agents, value: view.figures.agentsUsing, meta: copy.agentsMeta },
]

/** What the body draws: the tab's words and controls, the view, and whether it is the placeholder of the first read. */
interface BodyProps {
    readonly home: ConnectionsHomeBaseProps
    readonly view: ConnectionsListView
    readonly isLoading: boolean
}

/** The page body: what needs the owner, the health figures, then every connection with its filters and search. */
const Body = (input: BodyProps) => {
    const { props, on } = input.home
    return (
        <Stack gap="region">
            <AttentionSection
                title={props.copy.attentionHeading}
                view={input.view}
                pending={props.pending}
                on={on}
                isLoading={input.isLoading}
            />
            <SurfaceCard
                kind="figures"
                ariaLabel={props.copy.figuresLabel}
                items={figuresOf(props.copy, input.view)}
                isLoading={input.isLoading}
            />
            <ConnectionsTable props={props} on={on} view={input.view} isLoading={input.isLoading} />
        </Stack>
    )
}

/**
 * Draws the Connected tab of the Connections page as one full-width column: on top what needs the owner, each with its
 * one action; under it the health figures; then one card of every connection with its status, last event and agents, the filter
 * chips and the search. With no connection yet it is the invitation to the library alone.
 */
export const ConnectionsHomeBase = (props: ConnectionsHomeBaseProps) => {
    const { copy, slot } = props.props
    const { on } = props
    if ("isForbidden" in slot) {
        return (
            <EmptyNotice
                message={props.props.labels.forbidden}
                description={copy.forbiddenBody}
                iconSource={nivoIconSource("code", "leading")}
            />
        )
    }
    if ("isEmpty" in slot || ("items" in slot && slot.items.liveCount === 0)) {
        return (
            <EmptyNotice
                message={props.props.labels.empty}
                description={copy.emptyBody}
                iconSource={nivoIconSource("trigger", "leading")}
                actionLabel={copy.emptyAction}
                actionEndArrow
                onAction={on.openLibrary}
            />
        )
    }
    return (
        <SlotView
            slot={slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            onRetry={on.retry}
            render={(view, isLoading) => <Body home={props} view={view} isLoading={isLoading} />}
        />
    )
}
