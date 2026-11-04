import type { ReactNode } from "react"
import { Badge, Button, Grid, Page, Section, Stack } from "@starci/grammar/common"
import type { BadgeTone, Figure } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import type { AdminCardView, DataSlot, SlotLabels } from "@/modules/types"

/** The name, summary line and billing state of the workspace, as the page header draws them. */
export interface AdminWorkspaceScreenHead {
    readonly name: string
    readonly description: string
    readonly status: { readonly label: string; readonly tone: BadgeTone } | null
}

/** What the workspace screen draws under its header once the workspace is read. */
export interface AdminWorkspaceScreenData {
    readonly figures: ReadonlyArray<Figure>
    readonly cards: ReadonlyArray<AdminCardView>
}

/** The workspace read and the words around it. */
export interface AdminWorkspaceScreenBaseProps {
    readonly props: {
        readonly trailLabel: string
        readonly workspacesLabel: string
        readonly workspacesHref: string
        readonly overviewTitle: string
        readonly supportLabel: string
        readonly head: AdminWorkspaceScreenHead
        /** The workspace is not read yet: the header keeps its boxes under a shimmer. */
        readonly isHeadLoading: boolean
        readonly slot: DataSlot<AdminWorkspaceScreenData>
        /** The same screen with its words and no data: the labels stay real while the read is on its way. */
        readonly placeholder: AdminWorkspaceScreenData
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
        readonly openSupport: () => void
    }
    /** The support actions drawer of the workspace, composed by the page. */
    readonly children: ReactNode
}

/** What the body draws: the one read of the workspace, with its section title. */
interface BodyProps {
    readonly view: AdminWorkspaceScreenData
    readonly overviewTitle: string
    readonly isLoading: boolean
}

/** The overview figures and the list cards of one workspace, drawn together from the one read. */
const Body = (props: BodyProps) => (
    <Stack gap="section">
        <Section kind="figures" title={props.overviewTitle} items={props.view.figures} isLoading={props.isLoading} />
        <Grid kind="sections">
            {props.view.cards.map((card) => (
                <AdminRowsCard key={card.id} card={card} isLoading={props.isLoading} />
            ))}
        </Grid>
    </Stack>
)

/** Draws one workspace for the team: the trail, name and billing state, the support actions command that opens its drawer, the overview figures and the lists. */
export const AdminWorkspaceScreenBase = (props: AdminWorkspaceScreenBaseProps) => {
    const { head } = props.props
    return (
        <Page
            measure="full"
            isLoading={props.props.isHeadLoading}
            header={{
                breadcrumbs: {
                    label: props.props.trailLabel,
                    items: [
                        { id: "workspaces", label: props.props.workspacesLabel, href: props.props.workspacesHref },
                        {
                            id: "workspace",
                            label: head.name,
                            ...(props.props.isHeadLoading ? { isLoading: true as const } : {}),
                        },
                    ],
                },
                title: head.name,
                description: head.description,
                ...(head.status === null
                    ? {}
                    : {
                          status: (
                              <Badge tone={head.status.tone} isDot>
                                  {head.status.label}
                              </Badge>
                          ),
                      }),
                actions: (
                    <Button intent="neutral" onPress={props.on.openSupport}>
                        {props.props.supportLabel}
                    </Button>
                ),
            }}
        >
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(view, loading) => (
                    <Body view={view} overviewTitle={props.props.overviewTitle} isLoading={loading} />
                )}
            />
            {props.children}
        </Page>
    )
}
