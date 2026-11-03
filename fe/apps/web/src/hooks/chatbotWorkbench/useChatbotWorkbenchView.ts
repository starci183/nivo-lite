"use client"

import { useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import {
    CHATBOT_GAPS_PLACEHOLDER,
    useChatbotGaps,
    useChatbotWorkbench,
    type InboxFilter,
    type ChatbotChipView,
} from "@/hooks/chatbot"
import { CHATBOT_CUSTOMERS_PLACEHOLDER, useChatbotCustomers } from "@/hooks/chatbotCustomers"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWaiting } from "@/hooks/chatbotWaiting"
import { slotOfReads, useSlotLabels, WAITING_ROWS_PLACEHOLDER } from "@/hooks/slot"
import { workbenchRowDataOf, workbenchWaitingDataOf } from "@/hooks/workbench"
import { CHATBOT_WORKBENCH_TABS } from "./chatbotWorkbench.shared"
import type {
    DataSlot,
    SlotLabels,
    WorkbenchFigureData,
    WorkbenchRowData,
    CustomerRowView,
    LeadStageId,
    ChatbotGapRow,
} from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { ChatbotThreadEntry } from "@/hooks/chatbotThread"

/** Existing route identity, focus and server-resolved area labels. */
interface ChatbotWorkbenchViewInput {
    readonly installationId: string | null
    readonly tab: string | null
    readonly focus: string | null
    readonly customersLabel: string
    readonly gapsLabel: string
}

/** The view `useChatbotWorkbenchView` returns. */
export interface ChatbotWorkbenchViewShape {
    shape: "explanation" | "gaps" | "conversation" | "customers"
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
        selectedTab: "gaps" | "customers"
        tabsLabel: string
        tabs: {
            id: string
            label: string
        }[]
        ribbon: {
            label: string
            slot: DataSlot<readonly WorkbenchFigureData[]>
            placeholder: readonly WorkbenchFigureData[]
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
            edit: {
                workItemId: string
                text: string
                label: string
                sendLabel: string
                cancelLabel: string
                isBusy: boolean
            } | null
        }
        customers: {
            slot: DataSlot<readonly CustomerRowView[]>
            placeholder: readonly CustomerRowView[]
            labels: SlotLabels
            words: {
                label: string
                searchLabel: string
                searchPlaceholder: string
                clearLabel: string
                filtersLabel: string
                emptyMessage: string
                emptyDescription: string
                full: string
            }
            query: string
            filter: "all" | "progress" | "today" | "needs"
            chips: {
                id: "all" | "progress" | "today" | "needs"
                label: string
            }[]
            isFull: boolean
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
        gaps: {
            slot: DataSlot<ChatbotGapRow[]>
            placeholder: readonly ChatbotGapRow[]
            labels: SlotLabels
            title: string
            description: string
            isPending: boolean
            canFill: boolean
        }
    }
    on: {
        selectTab: (id: string) => void
        closeWhy: () => void
        retryDashboard: () => void
        retry: () => void
        customers: {
            query: (value: string) => void
            filter: (id: string) => void
            retry: () => void
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
        waiting: {
            retry: () => void
            changeEdit: (text: string) => void
            sendEdit: () => void
            cancelEdit: () => void
            command: (rowId: string, commandId: string) => void
        }
        gaps: {
            retry: () => void
            dismiss: (id: string) => void
        }
    }
}

/** Owns the real Chatbot desk, with separate mounted customers, inbox, gaps and waiting-editor lifetimes. */
export const useChatbotWorkbenchView = (input: ChatbotWorkbenchViewInput): ChatbotWorkbenchViewShape => {
    const t = useTranslations("workbenchChatbot")
    const dashboard = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const frame = useAgentDashboardFrame({ module: "chatbot", installationId: input.installationId, hasOwnGaps: true })
    const isOverview = frame.why.workItemId === null
    const workbench = useChatbotWorkbench(input.installationId, input.focus, isOverview)
    const scope = JSON.stringify([workbench.workspaceId, workbench.userId, input.installationId])
    const tabs = useAgentWorkbenchTabs({
        ids: CHATBOT_WORKBENCH_TABS,
        initialTab: input.focus === null ? input.tab : "customers",
        scope,
    })
    const customers = useChatbotCustomers(
        input.installationId,
        isOverview && tabs.selected === "customers" && input.focus === null,
    )
    const inbox = useChatbotInbox(workbench, isOverview && tabs.selected === "customers" && input.focus !== null, scope)
    const waiting = useChatbotWaiting(input.installationId, isOverview)
    const waitingData = workbenchWaitingDataOf(waiting.slot)
    const gaps = useChatbotGaps(
        workbench.workspaceId,
        workbench.canFillGaps,
        isOverview && tabs.selected === "gaps",
        scope,
    )
    return {
        shape: shapeOf(tabs.selected, input.focus, isOverview),
        props: propsOf({
            input,
            t,
            dashboard,
            slotLabels,
            frame,
            tabs,
            workbench,
            customers,
            inbox,
            waiting,
            waitingData,
            gaps,
        }),
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.reload,
            customers: {
                query: (value: string) => customers.setQuery(value),
                filter: customers.setFilter,
                retry: customers.reload,
            },
            inbox: { ...inbox.on, reload: workbench.reload },
            waiting: {
                ...waitingData.on,
                retry: waiting.reload,
                changeEdit: waiting.changeEdit,
                sendEdit: waiting.sendEdit,
                cancelEdit: waiting.cancelEdit,
            },
            gaps: {
                retry: gaps.reload,
                dismiss: (id: string) => {
                    void gaps.dismiss(id)
                },
            },
        },
    }
}

const shapeOf = (tab: (typeof CHATBOT_WORKBENCH_TABS)[number], focus: string | null, isOverview: boolean) => {
    if (!isOverview) return "explanation" as const
    if (tab === "gaps") return "gaps" as const
    return focus === null ? ("customers" as const) : ("conversation" as const)
}

/** Actual resolved source values used to assemble the pure desk's read models. */
interface ChatbotPropsInput {
    readonly input: ChatbotWorkbenchViewInput
    readonly t: ReturnType<typeof useTranslations<"workbenchChatbot">>
    readonly dashboard: ReturnType<typeof useTranslations<"agentDashboard">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly frame: ReturnType<typeof useAgentDashboardFrame>
    readonly tabs: ReturnType<typeof useAgentWorkbenchTabs<(typeof CHATBOT_WORKBENCH_TABS)[number]>>
    readonly workbench: ReturnType<typeof useChatbotWorkbench>
    readonly customers: ReturnType<typeof useChatbotCustomers>
    readonly inbox: ReturnType<typeof useChatbotInbox>
    readonly waiting: ReturnType<typeof useChatbotWaiting>
    readonly waitingData: ReturnType<typeof workbenchWaitingDataOf>
    readonly gaps: ReturnType<typeof useChatbotGaps>
}

const propsOf = (source: ChatbotPropsInput) => {
    const { input, t, dashboard, slotLabels, frame, tabs, workbench, customers, inbox, waiting, waitingData, gaps } =
        source
    return {
        why: frame.why,
        regions: frame.regions,
        selectedTab: tabs.selected,
        tabsLabel: frame.tabsLabel,
        tabs: [
            { id: "customers", label: input.customersLabel },
            { id: "gaps", label: input.gapsLabel },
        ],
        ribbon: {
            label: dashboard("ribbonAria"),
            slot: slotOfReads(workbench.reads, () => workbench.figures),
            placeholder: workbench.figures,
            labels: slotLabels(t("loadError")),
        },
        waiting: {
            slot: waitingData.slot,
            placeholder: WAITING_ROWS_PLACEHOLDER.map(workbenchRowDataOf),
            labels: slotLabels(dashboard("waitingEmpty")),
            list: {
                label: dashboard("waitingTitle"),
                count: waiting.count,
                more: waiting.more,
                emptyMessage: dashboard("waitingEmpty"),
                emptyDescription: dashboard("waitingEmptyBody"),
                seeWhyLabel: t("waitingSeeWhy"),
                moreLabel: t("waitingMoreMenu"),
            },
            edit:
                waiting.editing === null
                    ? null
                    : {
                          workItemId: waiting.editing.workItemId,
                          text: waiting.editing.text,
                          label: t("waitingEditLabel"),
                          sendLabel: t("waitingEditSend"),
                          cancelLabel: t("waitingEditCancel"),
                          isBusy: waiting.isBusy,
                      },
        },
        customers: {
            slot: customers.slot,
            placeholder: CHATBOT_CUSTOMERS_PLACEHOLDER,
            labels: slotLabels(t("customersEmpty")),
            words: {
                label: t("tabCustomers"),
                searchLabel: t("searchLabel"),
                searchPlaceholder: t("customersSearchPlaceholder"),
                clearLabel: t("clearSearch"),
                filtersLabel: t("customersFilters"),
                emptyMessage: t("customersEmpty"),
                emptyDescription: t("customersEmptyBody"),
                full: customers.full,
            },
            query: customers.query,
            filter: customers.filter,
            chips: customers.chips,
            isFull: customers.isFull,
        },
        inbox: {
            slot: slotOfReads(workbench.reads, () => inbox.props),
            placeholder: inbox.props,
            labels: slotLabels(t("title")),
        },
        gaps: {
            slot: gaps.slot,
            placeholder: CHATBOT_GAPS_PLACEHOLDER,
            labels: slotLabels(gaps.emptyTitle),
            title: gaps.title,
            description: gaps.description,
            isPending: gaps.isPending,
            canFill: workbench.canFillGaps,
        },
    }
}
