import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Button, EmptyNotice, Page, Stack, SurfaceCard } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ConnectionProviderTable } from "@/components/frames/ConnectionProviderTable"
import type { ConnectionProviderHead, ConnectionProviderView, DataSlot, SlotLabels } from "@/modules/types"

/** The words of a provider page. */
interface ConnectionProviderCopy {
    readonly crumbsLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly figuresLabel: string
    readonly listLabel: string
    readonly aboutLabel: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly errorBody: string
    readonly columns: {
        readonly account: string
        readonly status: string
        readonly agents: string
        readonly action: string
    }
    readonly open: string
    readonly agentsNote: string
    readonly agentsNone: string
    readonly agentsGrant: string
    /** Where an agent is granted a connection: the agents catalogue. */
    readonly agentsHref: string
}

/** The words, the band and the read of a provider page. */
export interface ConnectionProviderBaseProps {
    readonly props: {
        readonly copy: ConnectionProviderCopy
        readonly head: ConnectionProviderHead
        readonly slot: DataSlot<ConnectionProviderView>
        readonly labels: SlotLabels
        /** The connections are still being read: the band shows its skeleton. */
        readonly isLoading: boolean
        /** The viewer may add a connection (the owner). */
        readonly canAdd: boolean
    }
    readonly on: {
        readonly add: () => void
        readonly retry: () => void
    }
}

type Props = ConnectionProviderBaseProps

/** The geometry of a ready page: the three figures and two rows keep their cells while the read waits. */
const PLACEHOLDER: ConnectionProviderView = {
    canAdd: false,
    figures: ["running", "last", "agents"].map((id) => ({ id, term: "", value: "" })),
    rows: ["a", "b"].map((id) => ({
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
        uses: [],
    })),
    count: "",
    about: [{ id: "blurb", term: "", description: "" }],
}

/** What the body draws: the view and whether it is the placeholder of the first read. */
interface BodyProps extends Props {
    readonly view: ConnectionProviderView
    readonly isLoading: boolean
}

/** The body: the figures, the connections of the provider, and what the library says about it. */
const Body = (props: BodyProps) => {
    const { copy, head } = props.props
    const { view } = props
    if (view.rows.length === 0) {
        return (
            <EmptyNotice
                message={copy.emptyTitle}
                description={copy.emptyHint}
                iconSource={nivoIconSource("trigger", "leading")}
                {...(view.canAdd ? { actionLabel: head.addLabel, onAction: props.on.add } : {})}
            />
        )
    }
    return (
        <Stack gap="region">
            <SurfaceCard
                kind="figures"
                ariaLabel={copy.figuresLabel}
                items={view.figures}
                isLoading={props.isLoading}
            />
            <ConnectionProviderTable
                rows={view.rows}
                isLoading={props.isLoading}
                copy={{
                    label: copy.listLabel,
                    columns: copy.columns,
                    open: copy.open,
                    agentsNone: copy.agentsNone,
                    agentsGrant: copy.agentsGrant,
                    agentsHref: copy.agentsHref,
                    note: copy.agentsNote,
                }}
            />
            {view.about.length === 0 ? null : (
                <SurfaceCard
                    kind="details"
                    label={copy.aboutLabel}
                    isLoading={props.isLoading}
                    items={view.about.map((line) => ({ id: line.id, term: line.term, description: line.description }))}
                />
            )}
        </Stack>
    )
}

/**
 * Draws the page of one provider under Connections: the band (the trail, the mark, the title, the group and count, and
 * the one unit-specific add command), then a figures card, the list of the provider's connections (each row opens its page) and the
 * details card about the provider. With no connection yet it is the invitation to add the first one.
 */
export const ConnectionProviderBase = (props: ConnectionProviderBaseProps) => {
    const { copy, head, slot } = props.props
    return (
        <Page
            header={{
                breadcrumbs: { label: copy.crumbsLabel, items: [...copy.crumbs] },
                title: head.title,
                mark: <ProviderLogo glyph="apps" {...(head.markSrc === undefined ? {} : { src: head.markSrc })} />,
                meta: head.meta,
                ...(props.props.canAdd
                    ? {
                          actions: (
                              <Button startGlyph="plus" intent="commit" href={head.addHref}>
                                  {head.addLabel}
                              </Button>
                          ),
                      }
                    : {}),
            }}
            measure="product"
            isLoading={props.props.isLoading}
        >
            <SlotView
                slot={slot}
                placeholder={PLACEHOLDER}
                labels={props.props.labels}
                errorDescription={copy.errorBody}
                onRetry={props.on.retry}
                render={(body, isLoading) => <Body {...props} view={body} isLoading={isLoading} />}
            />
        </Page>
    )
}
