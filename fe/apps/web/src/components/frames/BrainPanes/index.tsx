import type { ReactNode } from "react"
import { Badge, IconTile, Page, Pane, PaneGrid } from "@starci/grammar/common"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { brainHeaderSubTabs } from "@/components/composites/BrainKnowledgeChips"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { BrainNotice } from "@/components/composites/BrainNotice"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { IconName } from "@/components/leaves/Icon"
import type { BrainHeadView, BrainPageHeaderView, DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"

/** The words of the panes of a list tab. */
interface BrainPanesCopy {
    readonly grid: string
    readonly list: string
    readonly detail: string
    readonly errorBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly back: string
}

/** What an entry of a list tab must give the panes: its id and the head band it opens with. */
interface BrainPanesEntry {
    readonly id: string
    readonly head: BrainHeadView
}

/** What the panes do. */
interface BrainPanesOn {
    readonly reviewAll: () => void
    readonly selectTab: (id: string) => void
    readonly back: () => void
    readonly retry: () => void
    /** Writes the first entry: the action of an empty page. */
    readonly add: () => void
}

/** What the panes of a Second Brain list tab draw. */
interface BrainPanesProps<Entry extends BrainPanesEntry> {
    readonly header: BrainPageHeaderView
    readonly panelId: string
    readonly copy: BrainPanesCopy
    readonly grid: PaneGridLayout
    readonly slot: DataSlot<ReadonlyArray<Entry>>
    readonly placeholder: ReadonlyArray<Entry>
    readonly slotLabels: SlotLabels
    readonly selectedId: string | null
    /** Some entries exist but the filter and the search keep none. */
    readonly isFiltered: boolean
    readonly glyph: IconName
    readonly on: BrainPanesOn
    /** The list pane body, with whatever it opens over itself. */
    readonly list: ReactNode
    /** The opened entry under its head band. */
    readonly renderDetail: (entry: Entry, isWaiting: boolean) => ReactNode
}

/** What the head band of the opened entry draws. */
interface EntryHeadProps {
    /** The opened entry; null while nothing is open. */
    readonly head: BrainHeadView | null
    readonly title: string
    readonly glyph: IconName
    readonly isWaiting: boolean
    readonly back: { readonly label: string; readonly onPress: () => void }
}

/** The head band of the opened entry: its mark, what it is, its chip and the one line under it; a phone gets the way back. */
const EntryHead = (props: EntryHeadProps) => {
    if (props.head === null) return <PaneHead title={props.title} headingLevel={1} back={props.back} />
    return (
        <PaneHead
            title={props.head.title}
            headingLevel={1}
            description={props.head.description}
            mark={<IconTile source={nivoIconSource(props.glyph, "leading")} tone="neutral" />}
            status={<Badge tone={props.head.badge.tone}>{props.head.badge.label}</Badge>}
            isLoading={props.isWaiting}
            back={props.back}
        />
    )
}

/** The main pane while nothing is open: the notice that asks for a choice, or says the filter kept nothing. */
/** What the blank main pane draws. */
interface BlankProps {
    readonly copy: BrainPanesCopy
    readonly isFiltered: boolean
}

const Blank = (props: BlankProps) => (
    <PaneBlank
        message={props.isFiltered ? props.copy.noMatchTitle : props.copy.pickTitle}
        description={props.isFiltered ? props.copy.noMatchBody : props.copy.pickBody}
        iconSource={nivoIconSource("brain", "leading")}
    />
)

/**
 * The page of a Second Brain list tab: the header with its tab strip, the chips of the knowledge tab across the top, then the panes
 * (the list the whole height, the head band over the main pane, the opened entry). A phone shows the list, or the opened entry with a
 * way back. A read that settled to a notice (nothing yet, or failed) puts the notice across the whole page instead.
 */
export const BrainPanes = <Entry extends BrainPanesEntry>(props: BrainPanesProps<Entry>) => {
    const { copy, slot } = props
    const isWaiting = "isLoading" in slot
    const isWhole = !("items" in slot) && !isWaiting
    const items = "items" in slot ? slot.items : []
    const entry = isWaiting
        ? (props.placeholder[0] ?? null)
        : (items.find((one) => one.id === props.selectedId) ?? null)
    const actions = "isError" in slot ? { review: null, add: null } : props.header.actions
    const grid = props.grid
    return (
        <Page
            chrome="panes"
            header={{
                ...props.header.heading,
                actions: <BrainHeaderActions review={actions.review} add={actions.add} onReview={props.on.reviewAll} />,
                tabs: brainHeaderTabs({ tabs: props.header.tabs, onSelect: props.on.selectTab }),
                ...brainHeaderSubTabs(props.header.chips),
            }}
            measure="product"
        >
            <PaneGrid
                label={copy.grid}
                role="tabpanel"
                id={props.panelId}
                areas={grid.areas}
                columns={grid.columns}
                rows={grid.rows}
            >
                {isWhole ? (
                    <Pane area="main" surface label={copy.detail}>
                        <BrainNotice
                            slot={slot}
                            placeholder={props.placeholder}
                            labels={props.slotLabels}
                            errorBody={copy.errorBody}
                            emptyBody={copy.emptyBody}
                            {...(actions.add === null
                                ? {}
                                : { emptyAction: { label: copy.emptyAction, onAction: props.on.add } })}
                            onRetry={props.on.retry}
                        />
                    </Pane>
                ) : null}
                {isWhole ? null : (
                    <Pane area="list" surface scroll label={copy.list}>
                        {props.list}
                    </Pane>
                )}
                {isWhole ? null : (
                    <Pane area="head" surface>
                        <EntryHead
                            head={entry?.head ?? null}
                            title={copy.list}
                            glyph={props.glyph}
                            isWaiting={isWaiting}
                            back={{ label: copy.back, onPress: props.on.back }}
                        />
                    </Pane>
                )}
                {!isWhole && entry === null ? (
                    <Pane area="main" surface label={copy.detail}>
                        <Blank copy={copy} isFiltered={props.isFiltered} />
                    </Pane>
                ) : null}
                {!isWhole && entry !== null ? (
                    <Pane area="main" scroll label={copy.detail}>
                        {props.renderDetail(entry, isWaiting)}
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}
