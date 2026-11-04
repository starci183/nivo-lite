import {
    Alert,
    Badge,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    IconTile,
    ListBox,
    PaneSection,
    SearchField,
    Stack,
    Switch,
    Tabs,
} from "@starci/grammar/common"
import type { DropdownMenuEntry, ListBoxItem } from "@starci/grammar/common"
import { AutomationAccountPicker } from "@/components/composites/AutomationAccountPicker"
import { AutomationGate } from "@/components/composites/AutomationGate"
import { AutomationMessage } from "@/components/composites/AutomationMessage"
import { AutomationRuns } from "@/components/composites/AutomationRuns"
import { AutomationSettings } from "@/components/composites/AutomationSettings"
import { PaneHead } from "@/components/composites/PaneHead"
import { automationIconOf } from "@/components/frames/AutomationCard"
import { AutomationPanes } from "@/components/frames/AutomationPanes"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AutomationsBoardView, CardView } from "@/modules/types"

/** The words of the panes that belong to no data. */
export interface AutomationsPanesCopy {
    readonly grid: string
    readonly list: string
    readonly search: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly back: string
    readonly moreActions: string
    readonly moreFilters: (count: number) => string
    readonly pickTitle: string
    readonly pickBody: string
    readonly emptyFiltered: string
}

/** The panes' words and the text in the search field. */
export interface AutomationsPanesView {
    readonly copy: AutomationsPanesCopy
    readonly query: string
}

/** The commands of the panes. */
export interface AutomationsPanesActions {
    readonly select: (key: string) => void
    readonly toggle: (key: string, next: boolean) => void
    readonly setFilter: (id: string) => void
    readonly search: (value: string) => void
    readonly close: () => void
    readonly dismiss: () => void
    readonly restore: (key: string) => void
    readonly pickAccount: (key: string, connectionId: string) => void
    readonly runNow: () => void
    readonly changeSetting: (key: string, value: string | number | boolean) => void
    readonly saveSettings: () => void
    readonly changeBody: (value: string) => void
    readonly enable: () => void
    readonly saveBody: () => void
    readonly compose: () => void
    readonly answerTrust: (accept: boolean) => void
}

/** What the panes draw. */
export interface AutomationsPanesDrawingProps {
    readonly view: AutomationsBoardView
    readonly isLoading: boolean
    readonly panes: AutomationsPanesView
    readonly on: AutomationsPanesActions
}

/** The panes and the opened card, which the head, the body and the list read. */
interface OpenedProps extends AutomationsPanesDrawingProps {
    readonly card: CardView
}

/** The mark of an automation: its template's glyph on a neutral tile. */
/** The card whose mark is drawn. */
interface MarkProps {
    readonly card: CardView
}

const Mark = (props: MarkProps) => <IconTile source={automationIconOf(props.card.icon)} tone="neutral" />

const itemsOf = (cards: ReadonlyArray<CardView>): ReadonlyArray<ListBoxItem> =>
    cards.map((card) => ({
        id: card.dataKey,
        label: card.name,
        description: card.triggerLine,
        leading: <Mark card={card} />,
        trailing: (
            <Badge isDot tone={card.statusTone}>
                {card.statusLabel}
            </Badge>
        ),
    }))

/** The cards whose name holds the search text, in the board's order. */
const matching = (cards: ReadonlyArray<CardView>, query: string): ReadonlyArray<CardView> => {
    const needle = query.trim().toLowerCase()
    return needle === "" ? cards : cards.filter((card) => card.name.toLowerCase().includes(needle))
}

/** The menu of the opened automation: restore it when hidden, else run it now and "not for me". */
const menuOf = (props: OpenedProps): ReadonlyArray<DropdownMenuEntry> => {
    const open = props.view.detail
    if (open === undefined) return []
    if (open.frame.isHidden) {
        return [{ id: "restore", label: open.frame.restoreLabel, onAction: () => props.on.restore(props.card.dataKey) }]
    }
    return [
        ...(open.runNow === undefined ? [] : [{ id: "run", label: open.runNow.label, onAction: props.on.runNow }]),
        { id: "dismiss", label: open.frame.dismissLabel, onAction: props.on.dismiss },
    ]
}

/** The head band of the opened automation: its mark, name, state, the switch and the menu. */
const DetailHead = (props: OpenedProps) => {
    const { card } = props
    return (
        <PaneHead
            title={props.view.detail?.frame.name ?? card.name}
            headingLevel={1}
            description={card.triggerLine}
            mark={<Mark card={card} />}
            status={
                <Badge isDot tone={card.statusTone}>
                    {card.statusLabel}
                </Badge>
            }
            back={{ label: props.panes.copy.back, onPress: props.on.close }}
            isLoading={props.isLoading}
            actions={
                <>
                    <Switch
                        name={card.switchName}
                        label={card.switchLabel}
                        isSelected={card.isEnabled}
                        isDisabled={card.isSwitchDisabled}
                        onSelectedChange={(next) => props.on.toggle(card.dataKey, next)}
                    />
                    <DropdownMenu
                        placement="bottom end"
                        entries={menuOf(props)}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={props.panes.copy.moreActions}
                            />
                        }
                    />
                </>
            }
        />
    )
}

/** The sections of the opened automation: what it waits for, the message, the gate, the Google account and the settings. */
const DetailBody = (props: OpenedProps) => {
    const { on, card } = props
    const open = props.view.detail
    if (open === undefined) return null
    const trust = open.gate?.trust
    const trustProps = trust === undefined ? {} : { trustOffer: { ...trust, onAnswer: on.answerTrust } }
    return (
        <Stack gap="section">
            {open.frame.awaitingText === undefined ? null : (
                <Alert title={open.frame.awaitingText} tone="informative" />
            )}
            {open.frame.errorText === undefined ? null : <Alert title={open.frame.errorText} tone="negative" />}
            {open.message === undefined ? null : (
                <AutomationMessage
                    {...open.message}
                    onChange={on.changeBody}
                    onEnable={on.enable}
                    onSave={on.saveBody}
                    onCompose={on.compose}
                />
            )}
            {open.gate === undefined ? null : <AutomationGate {...open.gate} {...trustProps} />}
            {card.accounts === undefined ? null : (
                <AutomationAccountPicker {...card.accounts} onPick={(id) => on.pickAccount(card.dataKey, id)} />
            )}
            <AutomationSettings {...open.settings} onChange={on.changeSetting} onSave={on.saveSettings} />
        </Stack>
    )
}

/** The list pane: the search, the underline filter with its counts, and the rows. */
/** The panes and the opened card, when one is open. */
interface ListPaneProps extends AutomationsPanesDrawingProps {
    readonly card: CardView | undefined
}

const ListPane = (props: ListPaneProps) => {
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

/** The three panes of the page layout, drawn from the board's view. */
export const AutomationsPanesDrawing = (props: AutomationsPanesDrawingProps) => {
    const { view, panes } = props
    const card = view.cards.find((item) => item.isSelected)
    const open = view.detail
    return (
        <AutomationPanes
            label={panes.copy.grid}
            isOpen={card !== undefined}
            list={<ListPane {...props} card={card} />}
            head={
                card === undefined ? (
                    <PaneHead
                        title={panes.copy.pickTitle}
                        headingLevel={1}
                        back={{ label: panes.copy.back, onPress: props.on.close }}
                    />
                ) : (
                    <DetailHead {...props} card={card} />
                )
            }
            main={
                open === undefined || card === undefined ? (
                    <PaneSection align="center" grow>
                        <EmptyNotice message={panes.copy.pickTitle} description={panes.copy.pickBody} />
                    </PaneSection>
                ) : (
                    <PaneSection gap="section">
                        <DetailBody {...props} card={card} />
                    </PaneSection>
                )
            }
            runsHead={<PaneHead title={open?.runs.title ?? panes.copy.list} />}
            runs={<PaneSection>{open === undefined ? null : <AutomationRuns {...open.runs} />}</PaneSection>}
        />
    )
}
