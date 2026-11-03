"use client"
import {
    ACCOUNTING_TABS,
    type AccountingWorkbenchData,
    type DataSlot,
    type SlotLabels,
    type AccountingPeriodKey,
    type AccountingLedgerKind,
    type AccountingQuestionCardData,
    type AccountingQuestionsActions,
} from "@/modules/types"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { accountingQuestionsPlaceholderOf, type AccountingLineageItem } from "@/modules/utils"
import { accountingFiguresOf } from "./accounting.shared"
import { useAccountingEvidence } from "./useAccountingEvidence"
import { useAccountingLedger } from "./useAccountingLedger"
import { useAccountingOverview } from "./useAccountingOverview"
import { useAccountingQuestions } from "./useAccountingQuestions"
import { useAccountingUpcoming } from "./useAccountingUpcoming"
import { useAccountingWaiting } from "./useAccountingWaiting"
import { useAccountingWorkbench } from "./useAccountingWorkbench"
import type { BadgeTone, Figure } from "@starci/grammar/common"
import type { AccountingUpcomingRow } from "@/hooks/accountingUpcoming"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import type { AccountingEvidenceValues } from "@/hooks/rhf"

type AccountingTab = (typeof ACCOUNTING_TABS)[number]

/** Route identity and server-resolved names of the Accounting areas. */
interface AccountingWorkbenchViewInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<AccountingTab, string>>
}

/** A resolved Accounting panel keeps its own read status and ready-shaped placeholder. */
const panelOf = <T>(slot: DataSlot<AccountingWorkbenchData>, view: T, labels: SlotLabels) => ({
    slot: mapSlot(slot, () => view),
    placeholder: view,
    labels,
})

/** The view `useAccountingWorkbenchView` returns. */
export interface AccountingWorkbenchViewShape {
    shape: "questions" | "ledger" | "overview" | "evidence" | "explanation"
    props: {
        why: {
            view: null
            labels: {
                pathLabel: string
                factsLabel: string
                sourcesLabel: string
                approverLabel: string
                timeLabel: string
                openOnMap: string
                missingTitle: string
                missingBody: string
            }
            closeLabel: string
            openLabel: string
            paneLabel: string
            listLabel: string
            workItemId: string | null
        }
        regions: {
            waiting: {
                label: string
                slot: DataSlot<{
                    count: string | null
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    count: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            done: {
                label: string
                slot: DataSlot<{
                    count: string
                    logLabel: string
                    logHref: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    count: string
                    logLabel: string
                    logHref: string
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            connections: {
                label: string
                slot: DataSlot<{
                    manageLabel: string
                    manageHref: "/connections"
                    rows: {
                        id: string
                        name: string
                        description: string
                        statusLabel: string
                        statusTone: BadgeTone
                        accessLabel: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        name: string
                        statusLabel: string
                        statusTone: "neutral"
                        accessLabel: string
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    manageLabel: string
                    manageHref: "/connections"
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            knowledge: {
                label: string
                slot: DataSlot<{
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }>
                placeholder: {
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }
                labels: SlotLabels
            }
        }
        selectedTab: "questions" | "ledger" | "overview" | "evidence"
        tabsLabel: string
        tabs: {
            id: "questions" | "ledger" | "overview" | "evidence"
            label: string
        }[]
        ribbon: {
            label: string
            slot: DataSlot<readonly Figure[]>
            placeholder: readonly Figure[]
            labels: SlotLabels
        }
        waiting: {
            slot: DataSlot<{
                title: string
                count: string | null
                rows: {
                    id: string
                    title: string
                    summary: string
                    reason: string
                    status: string
                    tone: "success" | "danger" | "warning"
                    amount: string | null
                    canAct: boolean
                    isOpen: boolean
                    isBusy: boolean
                    isApproveDisabled: boolean
                    basis: {
                        value: string
                        label: string
                        hint: string
                    } | null
                    approveLabel: string
                    rejectLabel: string
                    waitingLabel: string
                    error: string | null
                }[]
                more: string | null
                moreLabel: string
                moreHref: string
                moreMenuLabel: string
                emptyMessage: string
                emptyBody: string
            }>
            placeholder: {
                title: string
                count: string | null
                rows: {
                    id: string
                    title: string
                    summary: string
                    reason: string
                    status: string
                    tone: "success" | "danger" | "warning"
                    amount: string | null
                    canAct: boolean
                    isOpen: boolean
                    isBusy: boolean
                    isApproveDisabled: boolean
                    basis: {
                        value: string
                        label: string
                        hint: string
                    } | null
                    approveLabel: string
                    rejectLabel: string
                    waitingLabel: string
                    error: string | null
                }[]
                more: string | null
                moreLabel: string
                moreHref: string
                moreMenuLabel: string
                emptyMessage: string
                emptyBody: string
            }
            labels: SlotLabels
        }
        upcoming: {
            slot: DataSlot<{
                title: string
                rows: readonly AccountingUpcomingRow[]
                isUnknown: boolean
                emptyMessage: string
                emptyBody: string
                openBrainLabel: string
                note: string | null
            }>
            placeholder: {
                title: string
                rows: readonly AccountingUpcomingRow[]
                isUnknown: boolean
                emptyMessage: string
                emptyBody: string
                openBrainLabel: string
                note: string | null
            }
            labels: SlotLabels
        }
        overview: {
            slot: DataSlot<{
                title: string
                intro: string
                periodLabel: string
                periodItems: {
                    id: string
                    label: string
                }[]
                selectedPeriod: AccountingPeriodKey
                excludedNote: string | null
                trendTitle: string
                trendIntro: string
                trendSource: string
                trendEmpty: string
                ageingTitle: string
                ageingIntro: string
                ageingEmpty: string
                ageingMax: number
                ageing: {
                    id: "d0" | "d30" | "d60"
                    label: string
                    total: number
                    reading: string
                    tone: "neutral" | "cautionary" | "negative"
                }[]
                weekMax: number
                weeks: {
                    id: string
                    label: string
                    total: number
                    reading: string
                }[]
            }>
            placeholder: {
                title: string
                intro: string
                periodLabel: string
                periodItems: {
                    id: string
                    label: string
                }[]
                selectedPeriod: AccountingPeriodKey
                excludedNote: string | null
                trendTitle: string
                trendIntro: string
                trendSource: string
                trendEmpty: string
                ageingTitle: string
                ageingIntro: string
                ageingEmpty: string
                ageingMax: number
                ageing: {
                    id: "d0" | "d30" | "d60"
                    label: string
                    total: number
                    reading: string
                    tone: "neutral" | "cautionary" | "negative"
                }[]
                weekMax: number
                weeks: {
                    id: string
                    label: string
                    total: number
                    reading: string
                }[]
            }
            labels: SlotLabels
        }
        evidence: {
            slot: DataSlot<{
                lists: {
                    credits: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                    invoices: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                    orders: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                }
                isFormOpen: boolean
                formOpenLabel: string
                form: {
                    amount: string
                    date: string
                    maxDate: string
                    content: string
                    payer: string
                    note: string
                    isSaving: boolean
                    error: string | null
                    notice: string | null
                    dateLabel: string
                    contentLabel: string
                    contentHint: string
                    payerLabel: string
                    noteLabel: string
                    saveLabel: string
                    cancelLabel: string
                    foot: string
                    title: string
                    intro: string
                    amountLabel: string
                    amountHint: string | null
                }
                creditsTitle: string
                creditsIntro: string
                creditsEmpty: string
                creditsEmptyBody: string
                credits: readonly AccountingRecordView[]
                invoicesTitle: string
                invoicesIntro: string
                invoicesEmpty: string
                invoicesEmptyBody: string
                internalNote: string
                invoices: readonly AccountingRecordView[]
                ordersTitle: string
                ordersIntro: string
                ordersEmpty: string
                ordersEmptyBody: string
                orders: readonly AccountingRecordView[]
                supplierNeed: {
                    title: string
                    body: string
                    badge: string
                    actionLabel: string
                    actionHref: "/connections"
                } | null
            }>
            placeholder: {
                lists: {
                    credits: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                    invoices: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                    orders: {
                        label: string
                        empty: string
                        emptyBody: string
                        records: readonly AccountingRecordView[]
                    }
                }
                isFormOpen: boolean
                formOpenLabel: string
                form: {
                    amount: string
                    date: string
                    maxDate: string
                    content: string
                    payer: string
                    note: string
                    isSaving: boolean
                    error: string | null
                    notice: string | null
                    dateLabel: string
                    contentLabel: string
                    contentHint: string
                    payerLabel: string
                    noteLabel: string
                    saveLabel: string
                    cancelLabel: string
                    foot: string
                    title: string
                    intro: string
                    amountLabel: string
                    amountHint: string | null
                }
                creditsTitle: string
                creditsIntro: string
                creditsEmpty: string
                creditsEmptyBody: string
                credits: readonly AccountingRecordView[]
                invoicesTitle: string
                invoicesIntro: string
                invoicesEmpty: string
                invoicesEmptyBody: string
                internalNote: string
                invoices: readonly AccountingRecordView[]
                ordersTitle: string
                ordersIntro: string
                ordersEmpty: string
                ordersEmptyBody: string
                orders: readonly AccountingRecordView[]
                supplierNeed: {
                    title: string
                    body: string
                    badge: string
                    actionLabel: string
                    actionHref: "/connections"
                } | null
            }
            labels: SlotLabels
        }
        ledger: {
            slot: DataSlot<{
                selectedFilter: "all" | AccountingLedgerKind
                records: readonly AccountingRecordView[]
                drawer: {
                    isOpen: boolean
                    title: string
                    subtitle: string | null
                    closeLabel: string
                    lineageTitle: string
                    lineageIntro: string
                    lineage: readonly AccountingLineageItem[]
                    adjustTitle: string
                    adjustMode: "form" | "notReady" | "managersOnly" | "button" | "unavailable"
                    unavailableText: string
                    notReadyText: string
                    managersOnlyText: string
                    openLabel: string
                    form: {
                        note: string
                        amount: string
                        isSaving: boolean
                        error: string | null
                        intro: string
                        noteLabel: string
                        noteHint: string
                        amountLabel: string
                        amountHint: string
                        saveLabel: string
                        cancelLabel: string
                    }
                }
                title: string
                intro: string
                foot: string
                empty: string
                emptyBody: string
                filterLabel: string
                filterItems: {
                    id: string
                    label: string
                }[]
            }>
            placeholder: {
                selectedFilter: "all" | AccountingLedgerKind
                records: readonly AccountingRecordView[]
                drawer: {
                    isOpen: boolean
                    title: string
                    subtitle: string | null
                    closeLabel: string
                    lineageTitle: string
                    lineageIntro: string
                    lineage: readonly AccountingLineageItem[]
                    adjustTitle: string
                    adjustMode: "form" | "notReady" | "managersOnly" | "button" | "unavailable"
                    unavailableText: string
                    notReadyText: string
                    managersOnlyText: string
                    openLabel: string
                    form: {
                        note: string
                        amount: string
                        isSaving: boolean
                        error: string | null
                        intro: string
                        noteLabel: string
                        noteHint: string
                        amountLabel: string
                        amountHint: string
                        saveLabel: string
                        cancelLabel: string
                    }
                }
                title: string
                intro: string
                foot: string
                empty: string
                emptyBody: string
                filterLabel: string
                filterItems: {
                    id: string
                    label: string
                }[]
            }
            labels: SlotLabels
        }
        questions: {
            placeholder: {
                readonly intro: string
                readonly empty: string
                readonly emptyBody: string
                readonly groups: ReadonlyArray<{
                    readonly id: string
                    readonly title: string
                    readonly hint: string
                    readonly items: ReadonlyArray<AccountingQuestionCardData>
                }>
            }
            slot: DataSlot<{
                readonly intro: string
                readonly empty: string
                readonly emptyBody: string
                readonly groups: ReadonlyArray<{
                    readonly id: string
                    readonly title: string
                    readonly hint: string
                    readonly items: ReadonlyArray<AccountingQuestionCardData>
                }>
            }>
            labels: SlotLabels
        }
    }
    on: {
        selectTab: (id: string) => void
        closeWhy: () => void
        retryDashboard: () => void
        retry: () => void
        waiting: {
            approve: (id: string) => void
            reject: (id: string) => void
            changeBasis: (id: string, value: string) => void
        }
        upcoming: {
            openBrain: () => void
        }
        overview: {
            selectPeriod: (key: string) => void
        }
        evidence: {
            openForm: () => void
            closeForm: () => void
            changeField: (name: keyof AccountingEvidenceValues, value: string) => void
            submitForm: () => void
        }
        ledger: {
            selectFilter: (key: string) => void
            openEntry: (id: string) => void
            closeDrawer: () => void
            startAdjust: () => void
            cancelAdjust: () => void
            changeNote: (note: string) => void
            changeAmount: (amount: string) => void
            submitAdjust: () => void
        }
        questions: AccountingQuestionsActions
    }
}

/** The Accounting world owns its cards, independent read status and formerly mounted editor scopes. */
export const useAccountingWorkbenchView = (input: AccountingWorkbenchViewInput): AccountingWorkbenchViewShape => {
    const t = useTranslations("workbenchAccounting")
    const dashboard = useTranslations("agentDashboard")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const tabs = useAgentWorkbenchTabs({ ids: ACCOUNTING_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({
        module: "accounting",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const isOverview = frame.why.workItemId === null
    const workbench = useAccountingWorkbench(isOverview)
    const overview = useAccountingOverview(workbench.data, isOverview && tabs.selected === "overview", scope)
    const evidence = useAccountingEvidence(workbench.data, isOverview && tabs.selected === "evidence", scope)
    const ledger = useAccountingLedger(workbench.data, isOverview && tabs.selected === "ledger", scope)
    const questions = useAccountingQuestions(
        workbench.data.questions,
        workbench.data.ownerName,
        isOverview && tabs.selected === "questions",
        scope,
    )
    const upcoming = useAccountingUpcoming(workbench.data)
    const waiting = useAccountingWaiting(workbench.data, isOverview, scope)
    const items = accountingFiguresOf(workbench.data, format, t)
    return {
        shape: isOverview ? tabs.selected : ("explanation" as const),
        props: {
            why: frame.why,
            regions: frame.regions,
            selectedTab: tabs.selected,
            tabsLabel: frame.tabsLabel,
            tabs: ACCOUNTING_TABS.map((id) => ({
                id,
                label: frame.tabLabel({ id, label: input.tabs[id] }, "questions"),
            })),
            ribbon: {
                label: dashboard("ribbonAria"),
                slot: mapSlot(workbench.slot, () => items),
                placeholder: items,
                labels: slotLabels(t("loadFailedTitle")),
            },
            waiting: {
                slot: slotOfReads([workbench.read], () =>
                    waiting.props.rows.length === 0 ? undefined : waiting.props,
                ),
                placeholder: waiting.props,
                labels: slotLabels(t("questionsEmpty")),
            },
            upcoming: panelOf(workbench.slot, upcoming.props, slotLabels(t("loadFailedTitle"))),
            overview: panelOf(workbench.slot, overview.props, slotLabels(t("loadFailedTitle"))),
            evidence: panelOf(workbench.slot, evidence.props, slotLabels(t("invoicesEmpty"))),
            ledger: panelOf(workbench.slot, ledger.props, slotLabels(t("ledgerEmpty"))),
            questions: {
                ...panelOf(workbench.slot, questions.props, slotLabels(t("questionsEmpty"))),
                placeholder: accountingQuestionsPlaceholderOf(t),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            waiting: waiting.on,
            upcoming: upcoming.on,
            overview: overview.on,
            evidence: evidence.on,
            ledger: ledger.on,
            questions: questions.on,
        },
    }
}
