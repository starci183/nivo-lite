import { useAgentWorkbenchShell } from "@/hooks/agentDashboard"
import { LOYALTY_TABS } from "@/hooks/loyalty"
import type { LoyaltyTab, LoyaltyPanelInput } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useLoyaltyFiguresView } from "./useLoyaltyFiguresView"
import { useLoyaltyOverviewView } from "./useLoyaltyOverviewView"
import { useLoyaltyMembersView } from "./useLoyaltyMembersView"
import { useLoyaltyRewardsView } from "./useLoyaltyRewardsView"
import { useLoyaltyPromoView } from "./useLoyaltyPromoView"
import { useLoyaltyPendingView } from "./useLoyaltyPendingView"
import type { DataSlot, SlotLabels, RewardFormValues, RewardTextField } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { MemberSortKey } from "@/hooks/loyaltyMembers"

/** Server-resolved route identity and the five actual tab labels. */
interface LoyaltyWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<LoyaltyTab, string>>
}

/** The view `useLoyaltyWorkbenchView` returns. */
export interface LoyaltyWorkbenchView {
    shape: "overview" | "explanation" | "members" | "promo" | "decisions" | "rewards"
    props: {
        why: {
            label: string
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
        selectedTab: "pending" | "overview" | "members" | "promo" | "rewards"
        tabs: {
            id: "pending" | "overview" | "members" | "promo" | "rewards"
            label: string
        }[]
        ribbon: {
            label: string
            slot: DataSlot<
                {
                    id: string
                    value: string
                    meta: string
                }[]
            >
            captions: {
                id: string
                term: string
            }[]
            labels: SlotLabels
        }
        overview: {
            syncNote?: {
                title: string
                description: string
            }
            slot: DataSlot<{
                tiers: {
                    key: string
                    label: string
                    value: number
                    max: number
                    valueLabel: string
                }[]
                stats: {
                    id: string
                    term: string
                    description: string
                }[]
                linkUrl: string
            }>
            copy: {
                tiers: {
                    title: string
                    body: string
                }
                stats: {
                    title: string
                }
                link: {
                    title: string
                    body: string
                    copyLabel: string
                    copiedLabel: string
                    note: string
                }
                empty?: {
                    syncLabel?: string
                    title: string
                    body: string
                }
            }
            labels: SlotLabels
            isSyncing: boolean
        }
        members: {
            slot: DataSlot<{
                rows: {
                    tier?: {
                        name: string
                        tone: BadgeTone
                    }
                    id: string
                    label: string
                    description: string
                }[]
            }>
            copy: {
                detailId: "loyalty-member-detail"
                detailEmpty: {
                    readonly title: string
                    readonly body: string
                }
                showMoreLabel?: string
                selectedId: string | null
                empty?: {
                    title: string
                    body: string
                }
                title: string
                countLabel: string
                search: {
                    readonly label: string
                    readonly placeholder: string
                    readonly value: string
                }
                tier: {
                    readonly label: string
                    readonly value: string
                    readonly options: readonly [
                        {
                            readonly id: "all"
                            readonly label: string
                        },
                        ...{
                            id: string
                            label: string
                        }[],
                    ]
                }
                sort: {
                    readonly label: string
                    readonly value: MemberSortKey
                    readonly options: {
                        id: MemberSortKey
                        label: string
                    }[]
                }
            }
            labels: SlotLabels
            detail: {
                slot: DataSlot<{
                    identity: {
                        asOf: string
                        expiringLine?: string
                        points: string
                        contact: string
                        spentLine: string
                        joinedLine: string
                        nextTierLine: string
                        tier?: {
                            name: string
                            tone: BadgeTone
                        }
                        name: string
                    }
                    rewardRows: {
                        note?: string
                        blocked?: string
                        id: string
                        name: string
                        cost: string
                    }[]
                    ledgerRows: {
                        evidence?: string
                        ref?: string
                        dateTime: string
                        timeLabel: string
                        amount?: string
                        id: string
                        kind: string
                        tone: BadgeTone
                        points: string
                    }[]
                }>
                labels: SlotLabels
                copy: {
                    adjustTitle: string
                    adjustBody: string
                    adjust: {
                        isPending: boolean
                        note?: string
                        canSubmit: boolean
                        pointsLabel: string
                        pointsHint: string
                        pointsPlaceholder: string
                        reasonLabel: string
                        submitLabel: string
                        pointsError?: string
                        label: string
                        memberId: string
                        points: string
                        reason: string
                    }
                    rewards: {
                        title: string
                        emptyText: string
                        redeemLabel: string
                        busyId: string | null
                    }
                    ledger: {
                        title: string
                        emptyText: string
                    }
                    readOnly?: {
                        items: {
                            id: string
                            term: string
                            description: string
                        }[]
                        note: string
                    }
                    edit?: {
                        noteMax: number
                        saveLabel: string
                        isPending: boolean
                        nameLabel: string
                        birthdayLabel: string
                        birthdayPlaceholder: string
                        birthdayHint: string
                        noteLabel: string
                        birthdayError?: string
                        nameError?: string
                        label: string
                        memberId: string
                        name: string
                        birthday: string
                        note: string
                    }
                    closeLabel: string
                    editTitle: string
                }
            }
        }
        rewards: {
            slot: DataSlot<{
                rows: {
                    id: string
                    name: string
                    kindLabel: string
                    statusLabel: string
                    active: boolean
                    cost: string
                    facts: string
                    note: string
                }[]
            }>
            copy: {
                form?: {
                    heading: string
                    values: RewardFormValues
                    isPending: boolean
                    nameError: string | undefined
                    costError: string | undefined
                    kindOptions: {
                        id: string
                        label: string
                    }[]
                    tierOptions: {
                        id: string
                        label: string
                    }[]
                    noteMax: number
                    nameLabel: string
                    kindLabel: string
                    costLabel: string
                    valueLabel: string
                    valueHint: string
                    percentLabel: string
                    stockLabel: string
                    stockHint: string
                    limitLabel: string
                    limitHint: string
                    minTierLabel: string
                    noteLabel: string
                    activeLabel: string
                    saveLabel: string
                    cancelLabel: string
                }
                title: string
                addLabel: string
                canManage: boolean
                isPending: boolean
                emptyTitle: string
                emptyBody: string
                presetLabel: string
                readOnlyNote: string
                activeLabel: string
                editLabel: string
                deleteLabel: string
                askLabel: string
                confirmLabel: string
                cancelLabel: string
            }
            labels: SlotLabels
        }
        promo: {
            slot: DataSlot<{
                rows: {
                    id: string
                    name: string
                    statusLabel: string
                    statusTone: BadgeTone
                    counts: string
                    meta: string
                    draft: string
                }[]
            }>
            copy: {
                canManage: boolean
                copy: {
                    readonly title: string
                    readonly body: string
                    readonly tiers: string
                    readonly tiersHint: string
                    readonly inactive: string
                    readonly inactiveHint: string
                    readonly spend: string
                    readonly spendHint: string
                    readonly birthday: string
                    readonly name: string
                    readonly nameHint: string
                    readonly brief: string
                    readonly briefHint: string
                    readonly submit: string
                    readonly drafting: string
                    readonly failedTitle: string
                    readonly draftLabel: string
                    readonly managersOnly: string
                    readonly managersOnlyBody: string
                    readonly campaignsTitle: string
                    readonly campaignsEmptyTitle: string
                    readonly campaignsEmptyBody: string
                }
                tierOptions: {
                    value: string
                    label: string
                }[]
                values: {
                    readonly tiers: string[]
                    readonly inactive: string
                    readonly spend: string
                    readonly birthday: boolean
                    readonly name: string
                    readonly brief: string
                }
                briefError: string | undefined
                briefMax: 500
                isBusy: boolean
                isDrafting: boolean
                isSubmitDisabled: boolean
            }
            labels: SlotLabels
            preview: {
                slot: DataSlot<
                    {
                        readonly id: string
                        readonly text: string
                        readonly emphasis: boolean
                    }[]
                >
                labels: SlotLabels
                loadingLabel: string
                audienceLabel: string
            }
            campaign: {
                slot: DataSlot<{
                    result:
                        | {
                              readonly title: string
                              readonly recipients: string
                              readonly time: string
                              readonly draft: string
                          }
                        | undefined
                    failure: string | undefined
                }>
                labels: SlotLabels
                hasCampaign: boolean
            }
        }
        pending: {
            slot: DataSlot<{
                rows: {
                    id: string
                    actionLabel: string
                    age: string
                    customer: string
                    summary: string
                    reason: string
                    value: string
                    draft: string
                    canAct: boolean
                    canEditDraft: boolean
                    isEditing: boolean
                    isApproving: boolean
                    isRejecting: boolean
                }[]
            }>
            labels: SlotLabels
            copy: {
                label: string
                emptyTitle: string
                emptyBody: string
                draftLabel: string
                draftHint: string
                waitingManager: string
                approve: string
                reject: string
                edit: string
                editDone: string
                isPending: boolean
            }
        }
    }
    on: {
        selectTab: (id: string) => void
        closeWhy: () => void
        retryDashboard: () => void
        ribbon: {
            retry: () => void
        }
        overview: {
            sync: () => void
            copied: () => void
            retry: () => void
        }
        members: {
            search: (value: string) => void
            setTier: (value: string | null) => void
            setSort: (value: string | null) => void
            select: (id: string | null) => void
            showMore: () => void
            retry: () => void
            detail: {
                redeem: (rewardId: string) => void
                retry: () => void
                edit: {
                    onName: (text: string) => void
                    onBirthday: (text: string) => void
                    onNote: (text: string) => void
                    onSubmit: () => void
                }
                adjust: {
                    onPoints: (text: string) => void
                    onReason: (text: string) => void
                    onSubmit: () => void
                }
            }
        }
        rewards: {
            add: () => void
            preset: () => void
            edit: (id: string | null) => void
            toggle: (id: string, active: boolean) => void
            confirmRemove: (id: string) => Promise<void>
            change: (field: RewardTextField, value: string) => void
            setActive: (active: boolean) => void
            submit: () => void
            cancelForm: () => void
            retry: () => void
        }
        promo: {
            setTiers: (value: ReadonlyArray<string>) => void
            setInactive: (value: string) => void
            setSpend: (value: string) => void
            setBirthday: (value: boolean) => void
            setName: (value: string) => void
            setBrief: (value: string) => void
            submit: () => void
            retry: () => void
            retryPreview: () => void
            retryCampaign: () => void
        }
        pending: {
            approve: (id: string) => void
            reject: (id: string) => void
            toggleEdit: (id: string) => void
            setDraft: (id: string, value: string) => void
            retry: () => void
        }
    }
}

/** Owns the shared dashboard, one board read and the actual conditional panel sessions. */
export const useLoyaltyWorkbenchView = (input: LoyaltyWorkbenchInput): LoyaltyWorkbenchView => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const scope = JSON.stringify([activeWorkspaceId, input.installationId])
    const { tabs, dashboard, isNormal } = useAgentWorkbenchShell({
        module: "loyalty",
        installationId: input.installationId,
        ids: LOYALTY_TABS,
        initialTab: input.initialTab,
        scope,
    })
    const read = useQueryLoyaltyBoardSwr(isNormal)
    const panel = (id: LoyaltyTab): LoyaltyPanelInput => ({
        read,
        workspaceId: activeWorkspaceId,
        scope,
        isActive: isNormal && tabs.selected === id,
        isReady: read.data !== undefined,
    })
    const figures = useLoyaltyFiguresView({ ...panel("overview"), isActive: isNormal })
    const overview = useLoyaltyOverviewView(panel("overview"))
    const members = useLoyaltyMembersView(panel("members"))
    const rewards = useLoyaltyRewardsView(panel("rewards"))
    const promo = useLoyaltyPromoView(panel("promo"))
    const pending = useLoyaltyPendingView(panel("pending"))
    const selectedShape = tabs.selected === "pending" ? ("decisions" as const) : tabs.selected
    return {
        shape: isNormal ? selectedShape : ("explanation" as const),
        props: {
            why: { ...dashboard.why, label: dashboard.why.paneLabel },
            regions: dashboard.regions,
            tabsLabel: dashboard.tabsLabel,
            selectedTab: tabs.selected,
            tabs: LOYALTY_TABS.map((id) => ({ id, label: input.tabs[id] })),
            ribbon: figures.props,
            overview: overview.props,
            members: members.props,
            rewards: rewards.props,
            promo: promo.props,
            pending: pending.props,
        },
        on: {
            selectTab: tabs.select,
            closeWhy: dashboard.closeWhy,
            retryDashboard: dashboard.reload,
            ribbon: figures.on,
            overview: overview.on,
            members: members.on,
            rewards: rewards.on,
            promo: promo.on,
            pending: pending.on,
        },
    }
}
