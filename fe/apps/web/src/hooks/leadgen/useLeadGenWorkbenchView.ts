"use client"
import { LEADGEN_TABS, type DataSlot, type SlotLabels } from "@/modules/types"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentDashboardFrame, useAgentWorkbenchTabs } from "@/hooks/agentDashboard"
import { handoffsViewOf, leadsViewOf, sourcesViewOf } from "@/hooks/leadgenView"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { LEADGEN_PENDING_METRICS, leadGenFiguresOf } from "./leadgen.shared"
import { useLeadGenComments } from "./useLeadGenComments"
import { useLeadGenWorkbench } from "./useLeadGenWorkbench"
import type { BadgeTone, Figure } from "@starci/grammar/common"

type LeadGenTab = (typeof LEADGEN_TABS)[number]

/** Resolved route identity and the four tab labels supplied by the server page. */
interface LeadGenWorkbenchViewInput {
    readonly installationId: string | null
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<LeadGenTab, string>>
}

/** The view `useLeadGenWorkbenchView` returns. */
export interface LeadGenWorkbenchViewShape {
    shape: "sources" | "explanation" | "leads" | "comments" | "handoffs"
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
        tabsLabel: string
        selectedTab: "sources" | "leads" | "comments" | "handoffs"
        tabs: {
            id: "sources" | "leads" | "comments" | "handoffs"
            label: string
        }[]
        ribbon: {
            label: string
            slot: DataSlot<readonly Figure[]>
            placeholder: readonly Figure[]
            labels: SlotLabels
        }
        panel: {
            slot: DataSlot<{
                leads: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: string | null
                    rows: {
                        id: string
                        title: string
                        href: string
                        description: string
                        badges: {
                            label: string
                            tone: BadgeTone
                        }[]
                    }[]
                }
                sources: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: null
                    rows: {
                        id: string
                        title: string
                        href: null
                        description: string
                        badges: {
                            label: string
                            tone: "neutral"
                        }[]
                    }[]
                }
                handoffs: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: null
                    rows: {
                        id: string
                        title: string
                        href: string
                        description: string
                        badges: (
                            | {
                                  label: string
                                  tone: BadgeTone
                                  isDot?: never
                              }
                            | {
                                  label: string
                                  tone: BadgeTone
                                  isDot: boolean
                              }
                        )[]
                    }[]
                }
                comments: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    draftLabel: string
                    noDraft: string
                    editLabel: string
                    approveLabel: string
                    cancelLabel: string
                    saveApproveLabel: string
                    retryLabel: string
                    busyId: string | null
                    isApproving: boolean
                    rows: {
                        id: string
                        title: string
                        description: string
                        sourceLabel: string
                        comment: string
                        draft: string
                        isEditing: boolean
                        draftValue: string
                        error: string | null
                    }[]
                }
            }>
            placeholder: {
                leads: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: string | null
                    rows: {
                        id: string
                        title: string
                        href: string
                        description: string
                        badges: {
                            label: string
                            tone: BadgeTone
                        }[]
                    }[]
                }
                sources: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: null
                    rows: {
                        id: string
                        title: string
                        href: null
                        description: string
                        badges: {
                            label: string
                            tone: "neutral"
                        }[]
                    }[]
                }
                handoffs: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    hiddenText: null
                    rows: {
                        id: string
                        title: string
                        href: string
                        description: string
                        badges: (
                            | {
                                  label: string
                                  tone: BadgeTone
                                  isDot?: never
                              }
                            | {
                                  label: string
                                  tone: BadgeTone
                                  isDot: boolean
                              }
                        )[]
                    }[]
                }
                comments: {
                    label: string
                    emptyTitle: string
                    emptyBody: string
                    draftLabel: string
                    noDraft: string
                    editLabel: string
                    approveLabel: string
                    cancelLabel: string
                    saveApproveLabel: string
                    retryLabel: string
                    busyId: string | null
                    isApproving: boolean
                    rows: {
                        id: string
                        title: string
                        description: string
                        sourceLabel: string
                        comment: string
                        draft: string
                        isEditing: boolean
                        draftValue: string
                        error: string | null
                    }[]
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
        comments: {
            edit: (id: string) => void
            cancel: () => void
            draft: (_id: string, value: string) => void
            approve: (id: string, edited: boolean) => void
            retry: () => void
        }
    }
}

/** Resolves one Lead Gen workbench world; lower views receive data and atomic commands only. */
export const useLeadGenWorkbenchView = (input: LeadGenWorkbenchViewInput): LeadGenWorkbenchViewShape => {
    const t = useTranslations("workbenchLeadGen")
    const dashboard = useTranslations("agentDashboard")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const tabs = useAgentWorkbenchTabs({ ids: LEADGEN_TABS, initialTab: input.initialTab })
    const frame = useAgentDashboardFrame({
        module: "lead_gen",
        installationId: input.installationId,
        hasOwnGaps: false,
    })
    const workbench = useLeadGenWorkbench(input.installationId)
    const isCommentsActive = tabs.selected === "comments" && frame.why.workItemId === null
    const rows = "items" in workbench.slot ? workbench.slot.items.comments : []
    const comments = useLeadGenComments(rows, isCommentsActive)
    const panel = mapSlot(workbench.slot, (data) => ({
        leads: leadsViewOf(t, format, data.leads, data.leadsHidden),
        sources: sourcesViewOf(t, data.sources),
        handoffs: handoffsViewOf(t, format, data.handoffs),
        comments: comments.props,
    }))
    return {
        shape: frame.why.workItemId === null ? tabs.selected : ("explanation" as const),
        props: {
            why: frame.why,
            regions: frame.regions,
            tabsLabel: frame.tabsLabel,
            selectedTab: tabs.selected,
            tabs: LEADGEN_TABS.map((id) => ({ id, label: frame.tabLabel({ id, label: input.tabs[id] }, "comments") })),
            ribbon: {
                label: dashboard("ribbonAria"),
                slot: mapSlot(workbench.slot, (data) => leadGenFiguresOf(data.metrics, t)),
                placeholder: leadGenFiguresOf(LEADGEN_PENDING_METRICS, t),
                labels: slotLabels(t("loadFailedTitle")),
            },
            panel: {
                slot: panel,
                placeholder: {
                    leads: leadsViewOf(t, format, [], 0),
                    sources: sourcesViewOf(t, []),
                    handoffs: handoffsViewOf(t, format, []),
                    comments: comments.props,
                },
                labels: slotLabels(input.tabs[tabs.selected]),
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retry: workbench.retry,
            comments: comments.on,
        },
    }
}
