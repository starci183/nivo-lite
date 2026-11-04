import type { BadgeTone } from "@starci/grammar/common"

/** The copy of the promotion builder section. */
export interface PromotionCopy {
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

/** The data the promotion builder section draws. */
export interface PromotionViewData {
    readonly canManage: boolean
    readonly copy: PromotionCopy
    readonly tierOptions: {
        value: string
        label: string
    }[]
    readonly values: {
        readonly tiers: string[]
        readonly inactive: string
        readonly spend: string
        readonly birthday: boolean
        readonly name: string
        readonly brief: string
    }
    readonly briefError: string | undefined
    readonly briefMax: 500
    readonly isBusy: boolean
    readonly isDrafting: boolean
    readonly isSubmitDisabled: boolean
    readonly rows: {
        id: string
        name: string
        statusLabel: string
        statusTone: BadgeTone
        counts: string
        meta: string
        draft: string
    }[]
}
