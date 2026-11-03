"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { useChatbotWorkbench } from "@/hooks/chatbot"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useMember } from "@/hooks/member"
import {
    SALES_TABS,
    useSalesActivityView,
    useSalesAttentionView,
    useSalesHandoffsView,
    useSalesWorkbench,
} from "@/hooks/sales"
import { useSalesContractsView } from "@/hooks/salescontracts"
import { useSalesDecisionsView } from "@/hooks/salesdecisions"
import { salesFiguresOf, salesFiguresPlaceholderOf } from "@/hooks/salesfigures"
import { useSalesPipelineView } from "@/hooks/salesPipeline"
import { useSalesWaiting } from "@/hooks/salesWaiting"
import { mapSlot, slotOfReads, useSlotLabels, WAITING_ROWS_PLACEHOLDER } from "@/hooks/slot"
import { workbenchRowDataOf, workbenchWaitingDataOf } from "@/hooks/workbench"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useSalesOrdersView } from "./useSalesOrdersView"

import type { InboxFilter } from "@/hooks/chatbot"
import type {
    DataSlot,
    SlotLabels,
    WorkbenchFigureData,
    WorkbenchRowData,
    AttentionItemView,
    LaneView,
    MoveDialogView,
    HandoffItemView,
    SalesOrderRowView,
    SalesContractStatus,
    ContractImportDialogView,
    ActivityItemView,
    LeadStageId,
    ContractImportDialogEvents,
} from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { ChatbotChipView } from "../chatbot/chatbot.shared"
import type { ChatbotThreadEntry } from "../chatbotThread/chatbotThread.shared"
import type { ContractRow } from "@/hooks/salescontracts/useContractRows"

const SALES_INBOX_TABS: readonly [
    "attention",
    "pipeline",
    "decisions",
    "handoff",
    "contracts",
    "activity",
    "conversation",
] = [...SALES_TABS, "conversation"] as const
type SalesArea = (typeof SALES_INBOX_TABS)[number]

/** The existing Sales route identity and server-resolved tab labels. */
interface SalesWorkbenchViewInput {
    readonly installationId: string | null
    readonly tab: string
    readonly focus: string | null
    readonly conversation: string | null
    readonly tabs: Readonly<Record<SalesArea, string>>
}

type UseSalesWorkbenchViewResult = {
    shape:
        "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity" | "conversation" | "explanation"
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
        selectedTab: "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity" | "conversation"
        tabsLabel: string
        tabs: {
            id: "attention" | "pipeline" | "decisions" | "handoff" | "contracts" | "activity" | "conversation"
            label: string
        }[]
        gate: {
            slot: DataSlot<boolean>
            placeholder: boolean
            labels: SlotLabels
            name: string
        }
        ribbon: {
            label: string
            slot: DataSlot<readonly WorkbenchFigureData[]>
            placeholder: {
                id: string
                term: string
                value: string
            }[]
            labels: SlotLabels
        }
        waiting: {
            slot: DataSlot<WorkbenchRowData[]>
            placeholder: WorkbenchRowData[]
            labels: SlotLabels
            list: {
                label: string
                count: string | null
                more: {
                    label: string
                    href: string
                } | null
                emptyMessage: string
                emptyDescription: string
                seeWhyLabel: string
                moreLabel: string
            }
        }
        attention: {
            label: string
            emptyTitle: string
            emptyBody: string
            rows: readonly AttentionItemView[]
            answerLabel: string
            decideLabel: string
            retryLabel: string
            stopLabel: string
            followUpLabel: string
            replyLabel: string
            isBusy: boolean
        }
        pipeline: {
            label: string
            lanes: LaneView[]
            emptyText: string
            moveLabel: string
            cancelLabel: string
            confirmLabel: string
            dialog: MoveDialogView | null
            isPending: boolean
        }
        decisions: {
            pendingLabel: string
            emptyTitle: string
            emptyBody: string
            decidedTitle: string
            decidedBody: string
            decidedEmptyTitle: string
            decidedEmptyBody: string
            pending: {
                id: string
                anchor: string
                isFocused: boolean
                badge: string
                age: string
                isStale: boolean
                customer: string
                leadHref: string | null
                actionLabel: string
                summary: string
                reasonHint: string | null
                amountLine: string | null
                draft: string | null
                canAct: boolean
                assignedTo: string | null
                missing: {
                    name: string
                    label: string
                    value: string
                }[]
                isEditing: boolean
                draftValue: string
                showDraftField: boolean
                amountValue: string
                showAmountField: boolean
                canEdit: boolean
                isBusy: boolean
                isApproveBusy: boolean
                isRejectBusy: boolean
                isApproveDisabled: boolean
                editLabel: string
                error: string | null
            }[]
            decided: {
                id: string
                action: string
                outcomeLabel: string
                outcomeTone: BadgeTone
                customer: string
                href: string | null
                byline: string
                basis: string | null
                rest: string | null
            }[]
            rowLabels: {
                draftLabel: string
                waitingManager: string
                amountLabel: string
                approveLabel: string
                rejectLabel: string
            }
        }
        handoffs: {
            rows: readonly HandoffItemView[]
            isBusy: boolean
            ship: {
                isOpen: boolean
                title: string
                closeLabel: string
                saveLabel: string
                cancelLabel: string
                noticeTitle: string
                noticeText: string
                carrierLabel: string
                carrierHint: string
                trackingLabel: string
                carrier: string
                tracking: string
                error: string | null
                isPending: boolean
            } | null
            label: string
            intro: string
            emptyTitle: string
            emptyBody: string
            errorLabel: string
            shipLabel: string
        }
        orders: {
            title: string
            placeholder: readonly SalesOrderRowView[]
            slot: DataSlot<SalesOrderRowView[]>
            labels: SlotLabels
            hasNextPage: boolean
            isLoadingMore: boolean
            paginationFailure: string | null
            loadMoreLabel: string
            retryLabel: string
        }
        contracts: {
            label: string
            intro: string
            addLabel: string
            importLabel: string
            editLabel: string
            note: string
            rows: DataSlot<ContractRow[]>
            rowsPlaceholder: {
                readonly id: "placeholder"
                readonly title: "-"
                readonly description: "-"
                readonly statusLabel: "-"
                readonly statusTone: "neutral"
                readonly when: null
            }[]
            rowsLabels: SlotLabels
            drawer: {
                title: string
                closeLabel: string
                saveLabel: string
                cancelLabel: string
                leadLabel: string
                leadOptions: {
                    id: string
                    label: string
                }[]
                lead: string
                customerLabel: string
                customer: string
                planLabel: string
                planHint: string
                plan: string
                startLabel: string
                start: string
                endLabel: string
                endHint: string
                end: string
                amountLabel: string
                amount: string
                statusLabel: string
                statusOptions: {
                    id: SalesContractStatus
                    label: string
                }[]
                status: SalesContractStatus
                noteLabel: string
                note: string
                error: string | null
                isPending: boolean
                canSave: boolean
            } | null
            importDialog: ContractImportDialogView | null
        }
        activity: {
            label: string
            intro: string
            emptyTitle: string
            emptyBody: string
            rows: readonly ActivityItemView[]
            evidenceTitle: string
            byPolicy: string
        }
        inbox: {
            slot: DataSlot<{
                title: string
                actionFailedTitle: string
                actionError: string | null
                pane: "thread" | "list"
                hasSelection: boolean
                pickTitle: string
                pickBody: string
                list: {
                    title: string
                    searchLabel: string
                    searchPlaceholder: string
                    clearLabel: string
                    listLabel: string
                    query: string
                    filters: {
                        value: InboxFilter
                        label: string
                    }[]
                    selectedFilter: InboxFilter
                    items: {
                        id: string
                        name: string
                        preview: string
                        time: string
                        channel: string
                        chips: readonly ChatbotChipView[]
                    }[]
                    hasConversations: boolean
                    emptyListTitle: string
                    emptyListBody: string
                    emptyFilter: string
                    selectedId: string | null
                }
                thread: {
                    isResolving: boolean
                    hasThread: boolean
                    pickBody: string
                    backLabel: string
                    infoLabel: string
                    isInfoOpen: boolean
                    name: string
                    channel: string
                    chips: readonly ChatbotChipView[]
                    entries: readonly ChatbotThreadEntry[]
                    canReply: boolean
                    lockedText: string
                    composerLabel: string
                    composerPlaceholder: string
                    composerHint: string
                    sendLabel: string
                    draft: string
                    notSentTitle: string
                    error: string | null
                    isSending: boolean
                }
                sideLabel: string
                closeSideLabel: string
                isInfoOpen: boolean
                side: {
                    title: string
                    closeLabel: string
                    hasThread: boolean
                    customerName: string
                    channelLine: string
                    escalation: {
                        title: string
                        askedLabel: string
                        question: string
                        assigned: string | null
                        draftLabel: string
                        draftHint: string
                        draft: string
                        sendLabel: string
                        declineLabel: string
                        isAnswering: boolean
                        noticeTone: "negative" | null
                        noticeTitle: string
                        noticeText: string | null
                    } | null
                    stage: {
                        title: string
                        label: string
                        steps: readonly {
                            readonly id: LeadStageId
                            readonly label: string
                        }[]
                        currentId: LeadStageId
                    } | null
                    handling: {
                        title: string
                        text: string
                        buttonLabel: string
                        hint: string | null
                        isBusy: boolean
                    }
                    leadTitle: string
                    leadNone: string
                    lead: {
                        name: string
                        facts: readonly {
                            readonly id: string
                            readonly term: string
                            readonly description: string
                        }[]
                        openLabel: string
                        openHref: string
                    } | null
                }
            }>
            placeholder: {
                title: string
                actionFailedTitle: string
                actionError: string | null
                pane: "thread" | "list"
                hasSelection: boolean
                pickTitle: string
                pickBody: string
                list: {
                    title: string
                    searchLabel: string
                    searchPlaceholder: string
                    clearLabel: string
                    listLabel: string
                    query: string
                    filters: {
                        value: InboxFilter
                        label: string
                    }[]
                    selectedFilter: InboxFilter
                    items: {
                        id: string
                        name: string
                        preview: string
                        time: string
                        channel: string
                        chips: readonly ChatbotChipView[]
                    }[]
                    hasConversations: boolean
                    emptyListTitle: string
                    emptyListBody: string
                    emptyFilter: string
                    selectedId: string | null
                }
                thread: {
                    isResolving: boolean
                    hasThread: boolean
                    pickBody: string
                    backLabel: string
                    infoLabel: string
                    isInfoOpen: boolean
                    name: string
                    channel: string
                    chips: readonly ChatbotChipView[]
                    entries: readonly ChatbotThreadEntry[]
                    canReply: boolean
                    lockedText: string
                    composerLabel: string
                    composerPlaceholder: string
                    composerHint: string
                    sendLabel: string
                    draft: string
                    notSentTitle: string
                    error: string | null
                    isSending: boolean
                }
                sideLabel: string
                closeSideLabel: string
                isInfoOpen: boolean
                side: {
                    title: string
                    closeLabel: string
                    hasThread: boolean
                    customerName: string
                    channelLine: string
                    escalation: {
                        title: string
                        askedLabel: string
                        question: string
                        assigned: string | null
                        draftLabel: string
                        draftHint: string
                        draft: string
                        sendLabel: string
                        declineLabel: string
                        isAnswering: boolean
                        noticeTone: "negative" | null
                        noticeTitle: string
                        noticeText: string | null
                    } | null
                    stage: {
                        title: string
                        label: string
                        steps: readonly {
                            readonly id: LeadStageId
                            readonly label: string
                        }[]
                        currentId: LeadStageId
                    } | null
                    handling: {
                        title: string
                        text: string
                        buttonLabel: string
                        hint: string | null
                        isBusy: boolean
                    }
                    leadTitle: string
                    leadNone: string
                    lead: {
                        name: string
                        facts: readonly {
                            readonly id: string
                            readonly term: string
                            readonly description: string
                        }[]
                        openLabel: string
                        openHref: string
                    } | null
                }
            }
            labels: SlotLabels
        }
    }
    on: {
        selectTab: (id: string) => void
        closeWhy: () => void
        retryDashboard: () => void
        retry: () => void
        waiting: {
            retry: () => void
            command: (rowId: string, commandId: string) => void
        }
        attention: {
            retry: (key: string, workItemId: string) => void
            stop: (key: string, workItemId: string) => void
        }
        pipeline: {
            move: (leadId: string) => void
            target: (value: string) => void
            reason: (value: string) => void
            confirm: () => void
            close: () => void
        }
        decisions: {
            field: (id: string, name: string, value: string) => void
            draft: (id: string, value: string) => void
            amount: (id: string, value: string) => void
            toggleEdit: (id: string) => void
            decide: (id: string, decision: "rejected" | "approved") => void
        }
        handoffs: {
            run: (key: string, orderId: string) => void
            ship: (key: string) => void
            carrier: (value: string) => void
            tracking: (value: string) => void
            submit: () => void
            close: () => void
        }
        orders: {
            loadMore: () => void
            retry: () => undefined
        }
        contracts: {
            retry: () => void
            add: () => void
            openImport: () => void
            edit: (contractId: string) => void
            drawer: {
                lead: (value: string) => void
                customer: (value: string) => void
                plan: (value: string) => void
                start: (value: string) => void
                end: (value: string) => void
                amount: (value: string) => void
                status: (value: string) => void
                note: (value: string) => void
                submit: () => void
                close: () => void
            }
            import: ContractImportDialogEvents
        }
        inbox: {
            reload: () => void
            query: (value: string) => void
            filter: (value: string) => void
            select: (id: string) => void
            back: () => void
            toggleInfo: () => void
            draft: (text: string) => void
            send: () => void
            toggleHandling: () => void
            escalationDraft: (text: string) => void
            sendAnswer: () => void
            declineAnswer: () => void
        }
    }
}

/** Owns the real Sales desk and the independent lifetimes of its six panels and optional customer conversation. */
export const useSalesWorkbenchView = (input: SalesWorkbenchViewInput): UseSalesWorkbenchViewResult => {
    const me = useMember()
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, me?.userId, input.installationId])
    const tabs = useAgentWorkbenchTabs({
        ids: input.conversation === null ? SALES_TABS : SALES_INBOX_TABS,
        initialTab: input.tab,
        scope,
    })
    const frame = useAgentDashboardFrame({ module: "sales", installationId: input.installationId, hasOwnGaps: false })
    const isOverview = frame.why.workItemId === null
    const workbench = useSalesWorkbench(isOverview)
    const ready = isOverview && "items" in workbench.slot
    const attention = useSalesAttentionView(workbench.data, ready && tabs.selected === "attention", scope)
    const pipeline = useSalesPipelineView(workbench.data, ready && tabs.selected === "pipeline", scope)
    const decisions = useSalesDecisionsView(workbench.data, ready && tabs.selected === "decisions", scope, input.focus)
    const handoffs = useSalesHandoffsView(workbench.data, ready && tabs.selected === "handoff", scope)
    const orders = useSalesOrdersView(ready && tabs.selected === "handoff")
    const contracts = useSalesContractsView(workbench, ready && tabs.selected === "contracts", scope)
    const activity = useSalesActivityView(workbench.data)
    const inboxIsActive = isOverview && tabs.selected === "conversation" && input.conversation !== null
    const inboxRead = useChatbotWorkbench(null, input.conversation, inboxIsActive)
    const inbox = useChatbotInbox(inboxRead, inboxIsActive, scope)
    const waiting = useSalesWaiting(isOverview, scope)
    const waitingData = workbenchWaitingDataOf(waiting.slot)
    return {
        shape: salesShapeOf(tabs.selected, isOverview),
        props: useSalesProps({
            input,
            frame,
            tabs,
            workbench,
            attention,
            pipeline,
            decisions,
            handoffs,
            orders,
            contracts,
            activity,
            inboxRead,
            inbox,
            waiting,
            waitingData,
        }),
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            waiting: { ...waitingData.on, retry: waiting.reload },
            attention: attention.on,
            pipeline: pipeline.on,
            decisions: decisions.on,
            handoffs: handoffs.on,
            orders: orders.on,
            contracts: contracts.on,
            inbox: { ...inbox.on, reload: inboxRead.reload },
        },
    }
}

/** The optional conversation and explanation remain actual product drawings, not data-status shapes. */
const salesShapeOf = (tab: SalesArea, isOverview: boolean): SalesArea | "explanation" =>
    isOverview ? tab : "explanation"

interface SalesPropsInput {
    readonly input: SalesWorkbenchViewInput
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs<SalesArea>>
    readonly workbench: ReturnType<typeof useSalesWorkbench>
    readonly attention: ReturnType<typeof useSalesAttentionView>
    readonly pipeline: ReturnType<typeof useSalesPipelineView>
    readonly decisions: ReturnType<typeof useSalesDecisionsView>
    readonly handoffs: ReturnType<typeof useSalesHandoffsView>
    readonly orders: ReturnType<typeof useSalesOrdersView>
    readonly contracts: ReturnType<typeof useSalesContractsView>
    readonly activity: ReturnType<typeof useSalesActivityView>
    readonly inboxRead: ReturnType<typeof useChatbotWorkbench>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly waiting: ReturnType<typeof useSalesWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
}

/** Resolves the desk's actual data regions and copy after its domain owners have been read. */
const useSalesProps = (source: SalesPropsInput) => {
    const t = useTranslations("workbenchSales")
    const dashboard = useTranslations("agentDashboard")
    const chatbot = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const labels = useSlotLabels()
    const money = (amount: number | null) =>
        amount === null ? "-" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const {
        input,
        frame,
        tabs,
        workbench,
        attention,
        pipeline,
        decisions,
        handoffs,
        orders,
        contracts,
        activity,
        inboxRead,
        inbox,
        waiting,
        waitingData,
    } = source
    return {
        why: frame.why,
        regions: frame.regions,
        selectedTab: tabs.selected,
        tabsLabel: frame.tabsLabel,
        tabs: (input.conversation === null ? SALES_TABS : SALES_INBOX_TABS).map((id) => ({
            id,
            label: frame.tabLabel({ id, label: input.tabs[id] }, "decisions"),
        })),
        gate: {
            slot: mapSlot(workbench.slot, () => true),
            placeholder: true,
            labels: labels(t("loadFailedTitle")),
            name: input.tabs[tabs.selected],
        },
        ribbon: {
            label: dashboard("ribbonAria"),
            slot: mapSlot(workbench.slot, (data) => salesFiguresOf(data.metrics, { t, money })),
            placeholder: salesFiguresPlaceholderOf(t),
            labels: labels(t("loadFailedTitle")),
        },
        waiting: {
            slot: waitingData.slot,
            placeholder: WAITING_ROWS_PLACEHOLDER.map(workbenchRowDataOf),
            labels: labels(dashboard("waitingEmpty")),
            list: {
                label: dashboard("waitingTitle"),
                count: waiting.count,
                more: waiting.more,
                emptyMessage: dashboard("waitingEmpty"),
                emptyDescription: dashboard("waitingEmptyBody"),
                seeWhyLabel: t("waitingSeeWhy"),
                moreLabel: t("waitingMoreMenu"),
            },
        },
        attention: attention.props,
        pipeline: pipeline.props,
        decisions: decisions.props,
        handoffs: handoffs.props,
        orders: orders.props,
        contracts: contracts.props,
        activity,
        inbox: {
            slot: slotOfReads(inboxRead.reads, () => inbox.props),
            placeholder: inbox.props,
            labels: labels(chatbot("title")),
        },
    }
}
