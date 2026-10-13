import { Alert, EmptyNotice, PrimaryRailLayout } from "@starci/grammar/common"
import { AutomationAccountPicker } from "@/components/composites/AutomationAccountPicker"
import { AutomationCard, AutomationCardSkeleton } from "@/components/composites/AutomationCard"
import { AutomationDetailFrame } from "@/components/composites/AutomationDetailFrame"
import { AutomationFilters } from "@/components/composites/AutomationFilters"
import { AutomationGate } from "@/components/composites/AutomationGate"
import { AutomationHiddenList } from "@/components/composites/AutomationHiddenList"
import { AutomationMessage } from "@/components/composites/AutomationMessage"
import { AutomationRuns } from "@/components/composites/AutomationRuns"
import { AutomationSettings } from "@/components/composites/AutomationSettings"
import { SlotView } from "@/components/composites/SlotView"
import type { AutomationsBoardView, DataSlot, SlotLabels } from "@/modules/types"
import { SECTIONS_CLASS, SOLO_CLASS, collectionClass } from "./classNames"

const SKELETONS = [0, 1, 2]

/** The words that belong to no data. */
export interface AutomationsBoardLabels {
    readonly slot: SlotLabels
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
    }
    readonly on: {
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

const PLACEHOLDER: AutomationsBoardView = {
    filters: { label: "", items: [], selectedId: "" },
    cards: [],
    hidden: { title: "", restoreLabel: "", items: [] },
}

/** The cards, their filters, the detail and the hidden list. Shared by the automations page and the module settings card. */
export const AutomationsBoardBase = (props: AutomationsBoardBaseProps) => {
    const { layout, labels, slot } = props.props
    const { on } = props
    const isNested = layout === "module"
    return (
        <SlotView slot={slot} placeholder={PLACEHOLDER} labels={labels.slot}>
            {(view, isSkeleton) => {
                const collection = (
                    <div className={collectionClass(isNested, view.detail !== undefined)} aria-busy={isSkeleton || undefined}>
                        {isSkeleton
                            ? SKELETONS.map((index) => (
                                  <AutomationCardSkeleton
                                      key={index}
                                      loadingLabel={labels.loading}
                                      statusLabel={labels.status}
                                      selectLabel={labels.select}
                                      isNested={isNested}
                                  />
                              ))
                            : null}
                        {view.emptyText === undefined ? null : <EmptyNotice message={view.emptyText} />}
                        {view.cards.map((card) => (
                            <AutomationCard
                                key={card.dataKey}
                                {...card}
                                isNested={isNested}
                                onSelect={() => on.select(card.dataKey)}
                                onToggle={(next) => on.toggle(card.dataKey, next)}
                            >
                                {card.accounts === undefined ? null : (
                                    <AutomationAccountPicker
                                        {...card.accounts}
                                        onPick={(id) => on.pickAccount(card.dataKey, id)}
                                    />
                                )}
                            </AutomationCard>
                        ))}
                    </div>
                )
                const { detail: open } = view
                const detail =
                    open === undefined ? null : (
                        <AutomationDetailFrame
                            {...open.frame}
                            {...(open.runNow === undefined ? {} : { runNow: { ...open.runNow, onPress: on.runNow } })}
                            onClose={on.close}
                            onDismiss={on.dismiss}
                        >
                            <div className={SECTIONS_CLASS}>
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
                                {open.gate === undefined ? null : (
                                    <AutomationGate
                                        {...open.gate}
                                        {...(open.gate.trust === undefined
                                            ? {}
                                            : { trustOffer: { ...open.gate.trust, onAnswer: on.answerTrust } })}
                                    />
                                )}
                                <AutomationRuns {...open.runs} />
                            </div>
                        </AutomationDetailFrame>
                    )
                return (
                    <>
                        {isNested ? null : (
                            <AutomationFilters {...view.filters} onChange={on.setFilter} />
                        )}
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
                            </>
                        ) : (
                            <PrimaryRailLayout
                                primary={<div className={SOLO_CLASS}>{collection}</div>}
                                rail={detail}
                                railWidth="wide"
                            />
                        )}
                        <AutomationHiddenList
                            title={view.hidden.title}
                            restoreLabel={view.hidden.restoreLabel}
                            items={view.hidden.items}
                            onRestore={on.restore}
                        />
                    </>
                )
            }}
        </SlotView>
    )
}
