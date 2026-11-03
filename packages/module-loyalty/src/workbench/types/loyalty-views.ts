import type { BadgeTone } from "@starci/grammar/common"
import type { RewardFormValues, RewardTextField } from "./loyalty-rewards"
interface MemberEditFields {
    readonly label: string
    readonly memberId: string
    readonly name: string
    readonly birthday: string
    readonly note: string
    readonly nameError?: string
    readonly birthdayError?: string
    readonly nameLabel: string
    readonly birthdayLabel: string
    readonly birthdayPlaceholder: string
    readonly birthdayHint: string
    readonly noteLabel: string
    readonly noteMax: number
    readonly saveLabel: string
    readonly isPending: boolean
}

interface MemberAdjustFields {
    readonly label: string
    readonly memberId: string
    readonly points: string
    readonly reason: string
    readonly pointsError?: string
    readonly pointsLabel: string
    readonly pointsHint: string
    readonly pointsPlaceholder: string
    readonly reasonLabel: string
    readonly submitLabel: string
    readonly canSubmit: boolean
    readonly note?: string
    readonly isPending: boolean
}

interface MemberRewardOptions {
    readonly title: string
    readonly emptyText: string
    readonly redeemLabel: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly cost: string
        readonly blocked?: string
        readonly note?: string
    }>
    readonly busyId: string | null
}

interface MemberLedger {
    readonly title: string
    readonly emptyText: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly kind: string
        readonly tone: BadgeTone
        readonly points: string
        readonly amount?: string
        readonly dateTime: string
        readonly timeLabel: string
        readonly ref?: string
        readonly evidence?: string
    }>
}

interface RewardEditorFields {
    readonly heading: string
    readonly values: Readonly<RewardFormValues>
    readonly isPending: boolean
    readonly nameError?: string | undefined
    readonly costError?: string | undefined
    readonly kindOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly tierOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly nameLabel: string
    readonly kindLabel: string
    readonly costLabel: string
    readonly valueLabel: string
    readonly valueHint: string
    readonly percentLabel: string
    readonly stockLabel: string
    readonly stockHint: string
    readonly limitLabel: string
    readonly limitHint: string
    readonly minTierLabel: string
    readonly noteLabel: string
    readonly activeLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly noteMax: number
}

interface LoyaltyOverviewData {
    readonly empty?: {
        readonly title: string
        readonly body: string
        readonly syncLabel?: string
    }
    readonly tiers: {
        readonly title: string
        readonly body: string
        readonly rows: ReadonlyArray<{
            readonly key: string
            readonly label: string
            readonly value: number
            readonly max: number
            readonly valueLabel: string
        }>
    }
    readonly stats: {
        readonly title: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    }
    readonly link: {
        readonly title: string
        readonly body: string
        readonly url: string
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly note: string
    }
}

interface MemberOption {
    readonly id: string
    readonly label: string
}

interface LoyaltyMembersView {
    readonly title: string
    readonly countLabel: string
    readonly search: { readonly label: string; readonly placeholder: string; readonly value: string }
    readonly tier: {
        readonly label: string
        readonly value: string
        readonly options: ReadonlyArray<MemberOption>
    }
    readonly sort: {
        readonly label: string
        readonly value: string
        readonly options: ReadonlyArray<MemberOption>
    }
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly description: string
        readonly tier?: { readonly name: string; readonly tone: BadgeTone }
    }>
    readonly empty?: { readonly title: string; readonly body: string }
    readonly selectedId: string | null
    readonly showMoreLabel?: string
    readonly detailId: string
    readonly detailEmpty: { readonly title: string; readonly body: string }
}

interface RewardRowView {
    readonly id: string
    readonly name: string
    readonly kindLabel: string
    readonly statusLabel: string
    readonly active: boolean
    readonly cost: string
    readonly facts: string
    readonly note: string
}

interface LoyaltyRewardsView {
    readonly title: string
    readonly addLabel: string
    readonly canManage: boolean
    readonly isPending: boolean
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly presetLabel: string
    readonly readOnlyNote: string
    readonly activeLabel: string
    readonly editLabel: string
    readonly deleteLabel: string
    readonly askLabel: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly rows: ReadonlyArray<RewardRowView>
    readonly form?: RewardEditorFields
}

interface LoyaltyPromoRow {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly counts: string
    readonly meta: string
    readonly draft: string
}

interface LoyaltyPromoView {
    readonly canManage: boolean
    readonly copy: {
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
    readonly tierOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly values: {
        readonly tiers: ReadonlyArray<string>
        readonly inactive: string
        readonly spend: string
        readonly birthday: boolean
        readonly name: string
        readonly brief: string
    }
    readonly briefError?: string | undefined
    readonly briefMax: number
    readonly isBusy: boolean
    readonly isDrafting: boolean
    readonly isSubmitDisabled: boolean
    readonly rows: ReadonlyArray<LoyaltyPromoRow>
}

interface LoyaltyPendingRow {
    readonly id: string
    readonly actionLabel: string
    readonly age: string
    readonly customer: string
    readonly summary: string
    readonly reason: string
    readonly value: string
    readonly draft: string
    readonly canAct: boolean
    readonly canEditDraft: boolean
    readonly isEditing: boolean
    readonly isApproving: boolean
    readonly isRejecting: boolean
}

interface LoyaltyPendingView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly draftLabel: string
    readonly draftHint: string
    readonly waitingManager: string
    readonly approve: string
    readonly reject: string
    readonly edit: string
    readonly editDone: string
    readonly rows: ReadonlyArray<LoyaltyPendingRow>
    readonly isPending: boolean
}

interface LoyaltyMemberPanelView {
    readonly name: string
    readonly closeLabel: string
    readonly tier?: { readonly name: string; readonly tone: BadgeTone }
    readonly points: string
    readonly contact: string
    readonly spentLine: string
    readonly joinedLine: string
    readonly nextTierLine: string
    readonly expiringLine?: string
    readonly editTitle: string
    readonly edit?: MemberEditFields
    readonly readOnly?: {
        readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
        readonly note: string
    }
    readonly adjustTitle: string
    readonly adjustBody: string
    readonly adjust: MemberAdjustFields
    readonly rewards: MemberRewardOptions
    readonly ledger: MemberLedger
    readonly asOf: string
}

/** Canonical ready Loyalty atom models, promoted from the actual pure providers. */
export interface LoyaltyViews {
    readonly memberEdit: MemberEditFields
    readonly memberAdjust: MemberAdjustFields
    readonly memberRewards: MemberRewardOptions
    readonly memberLedger: MemberLedger
    readonly rewardEditor: RewardEditorFields
    readonly overview: LoyaltyOverviewData
    readonly members: LoyaltyMembersView
    readonly member: LoyaltyMemberPanelView
    readonly rewards: LoyaltyRewardsView
    readonly promotion: LoyaltyPromoView
    readonly decisions: LoyaltyPendingView
}
/** Actions stay separate from view data; their arguments and native confirmation promises retain their actual contracts. */
export interface LoyaltyActions {
    readonly memberEdit: {
        readonly onName: (value: string) => void
        readonly onBirthday: (value: string) => void
        readonly onNote: (value: string) => void
        readonly onSubmit: () => void
    }
    readonly memberAdjust: {
        readonly onPoints: (value: string) => void
        readonly onReason: (value: string) => void
        readonly onSubmit: () => void
    }
    readonly overview: { readonly sync: () => void; readonly copied: () => void; readonly retry: () => void }
    readonly members: {
        readonly search: (value: string) => void
        readonly setTier: (value: string | null) => void
        readonly setSort: (value: string | null) => void
        readonly select: (id: string | null) => void
        readonly showMore: () => void
        readonly retry: () => void
    }
    readonly rewards: {
        readonly add: () => void
        readonly preset: () => void
        readonly edit: (id: string) => void
        readonly toggle: (id: string, active: boolean) => void
        readonly confirmRemove: (id: string) => Promise<void>
        readonly change: (field: RewardTextField, value: string) => void
        readonly setActive: (active: boolean) => void
        readonly submit: () => void
        readonly cancelForm: () => void
        readonly retry: () => void
    }
    readonly decisions: {
        readonly approve: (id: string) => void
        readonly reject: (id: string) => void
        readonly toggleEdit: (id: string) => void
        readonly setDraft: (id: string, value: string) => void
        readonly retry: () => void
    }
    readonly member: {
        readonly edit: LoyaltyActions["memberEdit"]
        readonly adjust: LoyaltyActions["memberAdjust"]
        readonly redeem: (id: string) => void
        readonly retry: () => void
    }
    readonly promotion: {
        readonly setTiers: (value: ReadonlyArray<string>) => void
        readonly setInactive: (value: string) => void
        readonly setSpend: (value: string) => void
        readonly setBirthday: (value: boolean) => void
        readonly setName: (value: string) => void
        readonly setBrief: (value: string) => void
        readonly submit: () => void
        readonly retry: () => void
        readonly retryPreview: () => void
        readonly retryCampaign: () => void
    }
}
