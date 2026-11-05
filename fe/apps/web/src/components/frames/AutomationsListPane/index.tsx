import { Badge, EmptyNotice, ListBox, PaneSection, SearchField, Tabs } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { AutomationMark } from "@/components/composites/AutomationMark"
import type { AutomationsBoardView, AutomationsPanesActions, AutomationsPanesView, CardView } from "@/modules/types"

/** What the list pane draws: the board, the panes words, the opened card, and the commands. */
interface AutomationsListPaneProps {
    readonly view: AutomationsBoardView
    readonly isLoading: boolean
    readonly panes: AutomationsPanesView
    readonly on: AutomationsPanesActions
    readonly card: CardView | undefined
}

const itemsOf = (cards: ReadonlyArray<CardView>): ReadonlyArray<ListBoxItem> =>
    cards.map((card) => ({
        id: card.dataKey,
        label: card.name,
        description: card.triggerLine,
        leading: <AutomationMark icon={card.icon} />,
        trailing: (
            <Badge isDot tone={card.statusTone}>
                {card.statusLabel}
            </Badge>
        ),
    }))

/** The cards whose name holds the search text, in the board order. */
const matching = (cards: ReadonlyArray<CardView>, query: string): ReadonlyArray<CardView> => {
    const needle = query.trim().toLowerCase()
    return needle === "" ? cards : cards.filter((card) => card.name.toLowerCase().includes(needle))
}

/** The list pane: the search, the underline filter with its counts, and the rows. */
export const AutomationsListPane = (props: AutomationsListPaneProps) => {
    const { view, panes, on } = props
    return (
        <PaneSection gap="row">
            <SearchField
                label={panes.copy.search}
                isLabelHidden
                placeholder={panes.copy.searchPlaceholder}
                clearLabel={panes.copy.clearSearch}
                value={panes.query}
                onValueChange={on.search}
                onClear={() => on.search("")}
            />
            <Tabs
                label={view.filters.label}
                selectedKey={view.filters.selectedId}
                inset="none"
                labelVisibility="always"
                kind="filter"
                moreLabel={panes.copy.moreFilters}
                items={view.filters.items}
                onSelect={on.setFilter}
            />
            <ListBox
                label={panes.copy.list}
                selectionMode="single"
                selectionIndicator="none"
                selectedIds={props.card === undefined ? [] : [props.card.dataKey]}
                onAction={on.select}
                onSelectionChange={(ids) => {
                    const id = ids[0]
                    if (id !== undefined) on.select(id)
                }}
                isLoading={props.isLoading}
                emptyContent={<EmptyNotice message={view.emptyText ?? panes.copy.emptyFiltered} />}
                items={[...itemsOf(matching(view.cards, panes.query))]}
            />
        </PaneSection>
    )
}
