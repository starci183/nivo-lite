import { Alert, Button, EmptyNotice, PaneSection, Section, Stack } from "@starci/grammar/common"
import { AutomationAccountPicker } from "@/components/composites/AutomationAccountPicker"
import { AutomationCard } from "@/components/frames/AutomationCard"
import { AutomationPanes } from "@/components/frames/AutomationPanes"
import { AutomationsDetailBody } from "@/components/frames/AutomationsDetailBody"
import { AutomationsDetailHead } from "@/components/frames/AutomationsDetailHead"
import { AutomationsListPane } from "@/components/frames/AutomationsListPane"
import { PaneHead } from "@/components/composites/PaneHead"
import { AutomationDetailFrame } from "@/components/frames/AutomationDetailFrame"
import { AutomationFilters } from "@/components/composites/AutomationFilters"
import { AutomationGate } from "@/components/composites/AutomationGate"
import { AutomationHiddenList } from "@/components/composites/AutomationHiddenList"
import { AutomationMessage } from "@/components/composites/AutomationMessage"
import { AutomationRuns } from "@/components/composites/AutomationRuns"
import { AutomationSettings } from "@/components/composites/AutomationSettings"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { AutomationsBoardView, AutomationsPanesView, CardView, DataSlot, SlotLabels } from "@/modules/types"

/** The words that belong to no data. */
export interface AutomationsBoardLabels {
    readonly slot: SlotLabels
    readonly forbiddenDescription: string
    readonly backLabel: string
    readonly backHref: string
    readonly collection: string
    readonly loading: string
    readonly status: string
    readonly select: string
}

/** Props for {@link AutomationsBoardBase}. */
export interface AutomationsBoardBaseProps {
    readonly props: {
        readonly slot: DataSlot<AutomationsBoardView>
        /** "page": filters and a grid with the detail beside it. "module": one module's cards as a compact list, detail below. */
        readonly layout: "page" | "module"
        readonly labels: AutomationsBoardLabels
        /** The words and the search text of the page layout's panes. */
        readonly panes: AutomationsPanesView
    }
    readonly on: {
        readonly search: (value: string) => void
        readonly retry: () => void
        readonly select: (key: string) => void
        readonly toggle: (key: string, next: boolean) => void
        readonly setFilter: (id: string) => void
        readonly close: () => void
        readonly dismissError: () => void
        readonly restore: (key: string) => void
        readonly pickAccount: (key: string, connectionId: string) => void
        readonly dismiss: () => void
        readonly changeSetting: (key: string, value: string | number | boolean) => void
        readonly saveSettings: () => void
        readonly changeBody: (value: string) => void
        readonly enable: () => void
        readonly saveBody: () => void
        readonly compose: () => void
        readonly answerTrust: (accept: boolean) => void
        readonly runNow: () => void
    }
}

/** The cards a loading board draws in place of the real ones. */
const PLACEHOLDER_KEYS = ["a", "b", "c"] as const

/** Fake board of the same shape as the ready one: the skeleton reuses the ready tree, three cards wide. */
const placeholderOf = (labels: AutomationsBoardLabels): AutomationsBoardView => ({
    filters: {
        label: labels.loading,
        items: PLACEHOLDER_KEYS.map((key) => ({ id: key, label: labels.loading })),
        selectedId: PLACEHOLDER_KEYS[0],
    },
    cards: PLACEHOLDER_KEYS.map((key, index): CardView => ({
        dataKey: key,
        name: labels.loading,
        description: labels.loading,
        triggerLine: labels.loading,
        statusLabel: labels.status,
        statusTone: "neutral",
        icon: "payment",
        selectLabel: labels.select,
        switchLabel: labels.loading,
        switchName: key,
        isSelected: index === 0,
        isEnabled: false,
        isSwitchDisabled: true,
    })),
    detail: {
        frame: {
            name: labels.loading,
            description: labels.loading,
            closeLabel: labels.loading,
            dismissLabel: labels.loading,
            isHidden: false,
            restoreLabel: labels.loading,
            isBusy: false,
            isNested: false,
        },
        settings: { sectionLabel: labels.loading, fields: [], saveLabel: labels.loading, isBusy: false },
        message: {
            sectionLabel: labels.loading,
            title: labels.loading,
            help: labels.loading,
            bodyId: "loading-body",
            bodyLabel: labels.loading,
            bodyValue: labels.loading,
            maxLength: 600,
            variablesTitle: labels.loading,
            variables: [labels.loading],
            saveLabel: labels.loading,
            composeLabel: labels.loading,
            previewTitle: labels.loading,
            previewText: labels.loading,
            isBusy: false,
            isComposing: false,
            canEnable: false,
            canSave: false,
            isFirstApproval: false,
        },
        gate: { sectionLabel: labels.loading, authority: { gateLine: labels.loading } },
        runs: {
            title: labels.loading,
            emptyText: labels.loading,
            decisionsLabel: labels.loading,
            moreLabel: labels.loading,
            messageLabel: labels.loading,
            evidenceLabel: labels.loading,
            rows: PLACEHOLDER_KEYS.map((key) => ({
                id: key,
                statusLabel: labels.loading,
                tone: "neutral" as const,
                whenText: labels.loading,
                summary: labels.loading,
            })),
        },
    },
    hidden: { title: "", restoreLabel: "", items: [] },
})

/** The cards, their filters, the detail and the hidden list. Shared by the automations page and the module settings card. */
export const AutomationsBoardBase = (props: AutomationsBoardBaseProps) => {
    const { labels, slot, layout } = props.props
    return (
        <SlotView
            slot={slot}
            placeholder={placeholderOf(labels)}
            labels={labels.slot}
            onRetry={props.on.retry}
            {...(layout === "page" ? { forbiddenDescription: labels.forbiddenDescription } : {})}
            forbiddenAction={
                layout === "page" ? (
                    <Button intent="neutral" href={labels.backHref}>
                        {labels.backLabel}
                    </Button>
                ) : undefined
            }
            render={(view, isLoading) => renderAutomationsBoardView(view, isLoading, props)}
        />
    )
}

/** Draws the available cards, selected detail and hidden automations. */
const renderAutomationsBoardView = (
    view: AutomationsBoardView,
    isLoading: boolean,
    props: AutomationsBoardBaseProps,
) => {
    const { layout } = props.props
    const { on } = props
    const isNested = layout === "module"

    const collection = renderAutomationCards(isNested, view, isLoading, props)
    const { detail: open } = view
    const detail = renderAutomationDetail(open, on)
    return (
        <>
            {view.errorAlert === undefined ? null : (
                <Alert
                    title={view.errorAlert.title}
                    tone="negative"
                    dismissLabel={view.errorAlert.dismissLabel}
                    onDismiss={on.dismissError}
                />
            )}
            {isNested ? (
                <>
                    {collection}
                    {detail}
                    <AutomationHiddenList
                        title={view.hidden.title}
                        restoreLabel={view.hidden.restoreLabel}
                        items={view.hidden.items}
                        onRestore={on.restore}
                    />
                </>
            ) : (
                renderAutomationPanes(view, isLoading, props)
            )}
        </>
    )
}

/** The three panes of the page layout, drawn from the board's view. */
const renderAutomationPanes = (view: AutomationsBoardView, isLoading: boolean, props: AutomationsBoardBaseProps) => {
    const { panes } = props.props
    const { on } = props
    const card = view.cards.find((item) => item.isSelected)
    const open = view.detail
    return (
        <AutomationPanes
            label={panes.copy.grid}
            isOpen={card !== undefined}
            list={<AutomationsListPane view={view} isLoading={isLoading} panes={panes} on={on} card={card} />}
            head={
                card === undefined ? (
                    <PaneHead
                        title={panes.copy.pickTitle}
                        headingLevel={1}
                        back={{ label: panes.copy.back, onPress: on.close }}
                    />
                ) : (
                    <AutomationsDetailHead view={view} isLoading={isLoading} panes={panes} on={on} card={card} />
                )
            }
            main={<AutomationsDetailBody view={view} isLoading={isLoading} copy={panes.copy} on={on} card={card} />}
            runsHead={<PaneHead title={panes.copy.runsTitle} />}
            runs={<PaneSection>{open === undefined ? null : <AutomationRuns {...open.runs} isHeadless />}</PaneSection>}
        />
    )
}

/** Native collection rows own each name; the normal child frame retains all disjoint commands in its detail. */
const renderAutomationCards = (
    isNested: boolean,
    view: AutomationsBoardView,
    isLoading: boolean,
    props: AutomationsBoardBaseProps,
) => (
    <Section
        kind="list"
        title={props.props.labels.collection}
        isLoading={isLoading}
        filter={isNested ? undefined : <AutomationFilters {...view.filters} onChange={props.on.setFilter} />}
        items={view.cards.map((card) => ({
            id: card.dataKey,
            title: card.name,
            state: card.isSelected ? "informative" : "neutral",
            detail: (
                <AutomationCard
                    {...card}
                    onSelect={() => props.on.select(card.dataKey)}
                    onToggle={(next) => props.on.toggle(card.dataKey, next)}
                >
                    {card.accounts === undefined ? null : (
                        <AutomationAccountPicker
                            {...card.accounts}
                            onPick={(id) => props.on.pickAccount(card.dataKey, id)}
                        />
                    )}
                </AutomationCard>
            ),
        }))}
        empty={<EmptyNotice message={view.emptyText ?? props.props.labels.slot.empty} />}
    />
)

/** Draws the selected automation settings, message and gate. */
const renderAutomationDetail = (open: AutomationsBoardView["detail"], on: AutomationsBoardBaseProps["on"]) => {
    if (open === undefined) return null
    const trust = open.gate?.trust
    const trustProps = trust === undefined ? {} : { trustOffer: { ...trust, onAnswer: on.answerTrust } }
    return (
        <AutomationDetailFrame
            {...open.frame}
            {...(open.runNow === undefined ? {} : { runNow: { ...open.runNow, onPress: on.runNow } })}
            onClose={on.close}
            onDismiss={on.dismiss}
        >
            <Stack gap="section">
                <AutomationSettings {...open.settings} onChange={on.changeSetting} onSave={on.saveSettings} />
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
                <AutomationRuns {...open.runs} />
            </Stack>
        </AutomationDetailFrame>
    )
}
