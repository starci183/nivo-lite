import { Button, EmptyNotice, Pane, PaneGrid, PaneSection, Section } from "@starci/grammar/common"
import type { Figure, ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionsOverviewView, DataSlot, SlotLabels } from "@/modules/types"

/** The words of the overview pane. */
export interface ConnectionsHomeBaseProps {
    readonly props: {
        readonly copy: {
            readonly grid: string
            readonly title: string
            readonly mainLabel: string
            readonly figuresLabel: string
            readonly liveTerm: string
            readonly liveMeta: string
            readonly attentionTerm: string
            readonly attentionMeta: string
            readonly agentsTerm: string
            readonly nextTitle: string
            readonly agentsTitle: string
            readonly agentsEmpty: string
            readonly forbiddenBody: string
            readonly emptyBody: string
            readonly emptyAction: string
            readonly errorBody: string
            readonly ownerOnly: string
        }
        readonly slot: DataSlot<ConnectionsOverviewView>
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly goTo: (href: string) => void
        readonly openLibrary: () => void
        readonly retry: () => void
    }
}

/** The geometry of a ready overview: the figures keep their cells while the read waits. */
const PLACEHOLDER: ConnectionsOverviewView = {
    head: "",
    agentsMeta: "",
    workspace: "",
    count: 1,
    live: 0,
    attention: 0,
    agentCount: 0,
    activeAgents: 0,
    next: {
        id: "next",
        name: "",
        title: "",
        logo: { isWordmark: false },
        status: { label: "", tone: "neutral", isDot: false },
        body: "",
        action: null,
    },
    agents: ["a", "b", "c"].map((id) => ({
        id,
        name: "",
        levelLabel: "",
        description: "",
        level: "auto",
        connectionIds: [],
    })),
    canManage: false,
}

type Copy = ConnectionsHomeBaseProps["props"]["copy"]
type On = ConnectionsHomeBaseProps["on"]

/** The three key figures: what runs, what needs the owner, how many agents work through a connection. */
const figuresOf = (copy: Copy, view: ConnectionsOverviewView): ReadonlyArray<Figure> => {
    return [
        { id: "live", term: copy.liveTerm, value: view.live, meta: copy.liveMeta },
        { id: "attention", term: copy.attentionTerm, value: view.attention, meta: copy.attentionMeta },
        { id: "agents", term: copy.agentsTerm, value: view.agentCount, meta: view.agentsMeta },
    ]
}

/** The one card of the connection that needs the owner: its mark, its name and state, what is missing, and the one command. */
const nextRowsOf = (on: On, view: ConnectionsOverviewView): ReadonlyArray<ListRowData> => {
    const next = view.next
    if (next === null) return []
    const action = next.action
    return [
        {
            id: next.id,
            title: next.name,
            description: next.body,
            leading: {
                avatar: {
                    name: next.name,
                    ...(next.logo.src === undefined ? {} : { src: next.logo.src }),
                    shape: "square",
                },
                size: "md",
            },
            badges: [{ label: next.status.label, tone: next.status.tone, isDot: next.status.isDot }],
            detail:
                action === null ? undefined : (
                    <Button intent="commit" onPress={() => on.goTo(action.href)}>
                        {action.label}
                    </Button>
                ),
        },
    ]
}

/** One row per agent: who it is and the connections it works through. How far it may go is set on each connection's own page. */
const agentRowsOf = (view: ConnectionsOverviewView): ReadonlyArray<ListRowData> =>
    view.agents.map((agent) => ({
        id: agent.id,
        title: agent.name,
        description: agent.description,
        leading: { avatar: { name: agent.name, seed: agent.id, kind: "agent" as const } },
    }))

/** What the sections draw: the view, and whether it is the placeholder of the first read. */
interface OverviewBodyProps {
    readonly copy: Copy
    readonly on: On
    readonly view: ConnectionsOverviewView
    readonly isLoading: boolean
}

/** The sections of the overview: the figures, the connection that needs the owner, the agents. Each keeps its shape while the read waits. */
const OverviewBody = (props: OverviewBodyProps) => {
    const { copy } = props
    return (
        <>
            <Section
                kind="figures"
                ariaLabel={copy.figuresLabel}
                items={figuresOf(copy, props.view)}
                isLoading={props.isLoading}
            />
            <Section
                kind="list"
                title={copy.nextTitle}
                isLoading={props.isLoading}
                items={nextRowsOf(props.on, props.view)}
                empty={<EmptyNotice message={copy.agentsEmpty} />}
            />
            <Section
                kind="list"
                title={copy.agentsTitle}
                isLoading={props.isLoading}
                items={agentRowsOf(props.view)}
                empty={<EmptyNotice message={copy.agentsEmpty} />}
            />
        </>
    )
}

/**
 * Draws the overview of the Connections page, the pane beside the list when no connection is open: its head, the key figures, the
 * connection that needs the owner and what each agent may do through its connections. With no connection yet it is the invitation to
 * the library alone.
 */
export const ConnectionsHomeBase = (props: ConnectionsHomeBaseProps) => {
    const { copy, slot } = props.props
    if ("isForbidden" in slot) {
        return (
            <PaneGrid label={copy.grid} areas={["main"]}>
                <Pane area="main" label={copy.mainLabel}>
                    <PaneBlank
                        message={props.props.labels.forbidden}
                        description={copy.forbiddenBody}
                        iconSource={nivoIconSource("code", "leading")}
                    />
                </Pane>
            </PaneGrid>
        )
    }
    if ("isEmpty" in slot) {
        return (
            <PaneGrid label={copy.grid} areas={["main"]}>
                <Pane area="main" label={copy.mainLabel}>
                    <PaneSection align="center" grow>
                        <EmptyNotice
                            message={props.props.labels.empty}
                            description={copy.emptyBody}
                            iconSource={nivoIconSource("trigger", "leading")}
                            actionLabel={copy.emptyAction}
                            onAction={props.on.openLibrary}
                        />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        )
    }
    const view = "items" in slot ? slot.items : undefined
    return (
        <PaneGrid label={copy.grid} areas={["head", "main"]} rows={["auto", "fill"]}>
            <Pane area="head" surface>
                <PaneHead
                    title={copy.title}
                    headingLevel={1}
                    description={view === undefined ? copy.title : view.head}
                    isLoading={view === undefined}
                />
            </Pane>
            <Pane area="main" surface scroll label={copy.mainLabel}>
                <PaneBody>
                    <SlotView
                        slot={slot}
                        placeholder={PLACEHOLDER}
                        labels={props.props.labels}
                        errorDescription={copy.errorBody}
                        onRetry={props.on.retry}
                        render={(data, isLoading) => (
                            <OverviewBody copy={copy} on={props.on} view={data} isLoading={isLoading} />
                        )}
                    />
                </PaneBody>
            </Pane>
        </PaneGrid>
    )
}
