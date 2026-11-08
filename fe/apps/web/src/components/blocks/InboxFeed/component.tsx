import {
    Badge,
    DescriptionList,
    IconButton,
    IconTile,
    Page,
    Pane,
    PaneGrid,
    Quote,
    SurfaceCard,
    type ListBoxItem,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneHead } from "@/components/composites/PaneHead"
import { PaneList } from "@/components/frames/PaneList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, InboxRowView, PaneGridLayout, SlotLabels } from "@/modules/types"

/** Props for {@link InboxFeedBase}. */
export interface InboxFeedBaseProps {
    readonly props: {
        readonly copy: {
            readonly grid: string
            readonly title: string
            readonly pageBody: string
            readonly listLabel: string
            readonly detailLabel: string
            readonly pickTitle: string
            readonly pickBody: string
            readonly emptyBody: string
            readonly emptyAction: string
            readonly errorBody: string
            readonly refresh: string
            readonly back: string
            readonly contentTitle: string
            readonly quoteSource: string
            readonly detailsTitle: string
            readonly duplicatesNote: string
            readonly terms: {
                readonly from: string
                readonly contact: string
                readonly channel: string
                readonly kind: string
                readonly received: string
                readonly duplicates: string
            }
        }
        /** The one line above the rows: the order, and how many repeats were blocked when some were. */
        readonly summary: string
        readonly slot: DataSlot<ReadonlyArray<InboxRowView>>
        /** The first read has no data yet. */
        readonly isWaiting: boolean
        readonly labels: SlotLabels
        /** The opened input; the first when none was chosen. */
        readonly selectedId: string | null
        /** The areas and tracks of the pane grid, for the pane the phone shows. */
        readonly grid: PaneGridLayout
    }
    readonly on: {
        readonly refresh: () => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly openConnections: () => void
    }
}

/** One resting row: the skeleton keeps the geometry of the ready list and detail. */
const PLACEHOLDER: ReadonlyArray<InboxRowView> = ["a", "b", "c", "d", "e"].map((id) => ({
    id,
    title: "",
    sender: "",
    source: "",
    kind: "",
    channelKey: "",
    kindKey: "",
    ago: "",
    agoShort: "",
    status: { label: "", tone: "neutral" },
    body: "",
    line: "",
    details: [],
    duplicates: 0,
}))

/** The glyph of the row: the money kinds and the order kind have their own, a website its globe, the rest a conversation. */
const glyphOf = (row: InboxRowView): "wallet" | "cart" | "explore" | "chat" => {
    if (row.kindKey === "payment") return "wallet"
    if (row.kindKey === "order") return "cart"
    return row.channelKey === "website" ? "explore" : "chat"
}

/** The list rows: the sender, one line of what arrived, and at the end the time over the status. */
const itemsOf = (rows: ReadonlyArray<InboxRowView>): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.sender,
        description: row.line,
        descriptionLines: 2 as const,
        leading: <IconTile source={nivoIconSource(glyphOf(row), "leading")} tone="neutral" />,
        trailing: <RowTrailing meta={row.agoShort} badge={row.status} />,
    }))

/** What the opened input draws below its head: the words, then the facts about it. */
interface InboxDetailProps {
    readonly row: InboxRowView
    readonly copy: InboxFeedBaseProps["props"]["copy"]
    readonly isWaiting: boolean
}

/** The opened input's two cards. The terms stay real while the facts load, so the skeleton keeps the ready rows. */
const InboxDetail = (props: InboxDetailProps) => {
    const { row, copy } = props
    const pairs = props.isWaiting
        ? (["from", "contact", "channel", "kind", "received"] as const).map((key) => ({
              key,
              term: copy.terms[key],
              text: "",
          }))
        : row.details
    const items = [
        ...pairs.map((pair) => ({ id: pair.key, term: pair.term, description: pair.text })),
        ...(row.duplicates > 0
            ? [{ id: "duplicates", term: copy.terms.duplicates, description: String(row.duplicates) }]
            : []),
    ]
    return (
        <>
            {row.body === "" && !props.isWaiting ? null : (
                <SurfaceCard label={copy.contentTitle} isLoading={props.isWaiting}>
                    <Quote source={copy.quoteSource} text={row.body} isLoading={props.isWaiting} />
                </SurfaceCard>
            )}
            <SurfaceCard label={copy.detailsTitle} isLoading={props.isWaiting} note={copy.duplicatesNote}>
                <DescriptionList items={items} isLoading={props.isWaiting} />
            </SurfaceCard>
        </>
    )
}

type Props = InboxFeedBaseProps

/** The list rows through the slot's one status recipe: skeleton, empty notice with its action, failure band with its retry. */
const ListBody = (props: Props) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            emptyDescription={copy.emptyBody}
            emptyIconSource={nivoIconSource("email", "leading")}
            emptyAction={{ label: copy.emptyAction, onAction: props.on.openConnections }}
            onRetry={props.on.refresh}
            render={(items, loading) => (
                <PaneList
                    label={copy.listLabel}
                    summary={props.props.summary}
                    items={itemsOf(items)}
                    selectedId={props.props.selectedId}
                    onSelect={props.on.select}
                    empty={{ message: props.props.labels.empty }}
                    isLoading={loading}
                />
            )}
        />
    )
}

/** The opened input: its skeleton while the read waits, the input once it is in, or nothing when none is open. */
const openedOf = (view: Props["props"]): InboxRowView | null => {
    if (view.isWaiting) return PLACEHOLDER[0] ?? null
    return ("items" in view.slot ? view.slot.items : []).find((entry) => entry.id === view.selectedId) ?? null
}

/** The head band of the opened input: what it is, where from, and its state. */
const mainHeadOf = (view: Props["props"], row: InboxRowView) => {
    return {
        title: row.title,
        headingLevel: 1 as const,
        description: `${row.source} · ${row.ago}`,
        mark: <IconTile source={nivoIconSource(glyphOf(row), "leading")} tone="neutral" />,
        status: <Badge tone={row.status.tone}>{row.status.label}</Badge>,
        isLoading: view.isWaiting,
    }
}

/** Draws the Inbox as the chat pattern: the received inputs beside the opened one, a phone shows one pane with a back control. */
export const InboxFeedBase = (props: InboxFeedBaseProps) => {
    const view = props.props
    const { copy } = view
    const row = openedOf(view)
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <PaneHead
                        title={copy.title}
                        actions={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("retry", "leading")}
                                label={copy.refresh}
                                onPress={props.on.refresh}
                            />
                        }
                    />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody>
                        <ListBody {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    {row === null ? (
                        <PaneHead
                            title={copy.title}
                            headingLevel={1}
                            description={copy.pageBody}
                            back={{ label: copy.back, onPress: props.on.back }}
                        />
                    ) : (
                        <PaneHead {...mainHeadOf(view, row)} back={{ label: copy.back, onPress: props.on.back }} />
                    )}
                </Pane>
                {row === null ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <PaneBlank
                            message={copy.pickTitle}
                            description={copy.pickBody}
                            iconSource={nivoIconSource("email", "leading")}
                        />
                    </Pane>
                ) : (
                    <Pane area="main" scroll label={copy.detailLabel}>
                        <PaneBody>
                            <InboxDetail row={row} copy={copy} isWaiting={view.isWaiting} />
                        </PaneBody>
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
