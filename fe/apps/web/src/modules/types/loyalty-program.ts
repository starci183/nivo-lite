// The view types of the loyalty programme form.
/** The copy of the programme form: every label and hint, already translated. */
export interface ProgramCopy {
    readonly readOnlyNote: string
    readonly earnTitle: string
    readonly earnHint: string
    readonly name: string
    readonly perThousand: string
    readonly perThousandHint: string
    readonly perVisit: string
    readonly minOrder: string
    readonly minOrderHint: string
    readonly trigger: string
    readonly triggerHint: string
    readonly categories: string
    readonly categoriesHint: string
    readonly catMatch: string
    readonly catRate: string
    readonly catLabel: string
    readonly addCategory: string
    readonly remove: string
    readonly tiersTitle: string
    readonly tiersHint: string
    readonly tierName: string
    readonly tierSpend: string
    readonly tierFirst: string
    readonly tierMult: string
    readonly tierMultHint: string
    readonly tierWinback: string
    readonly tierWinbackHint: string
    readonly tierBenefit: string
    readonly addTier: string
    readonly expiryTitle: string
    readonly expiryHint: string
    readonly expiryMonths: string
    readonly expiryMonthsHint: string
    readonly warnDays: string
    readonly warnDaysHint: string
    readonly birthdayTitle: string
    readonly birthdayOn: string
    readonly birthdayPoints: string
    readonly birthdayReward: string
    readonly birthdayNote: string
    readonly birthdayNoteHint: string
    readonly promoTitle: string
    readonly promoHint: string
    readonly maxPerMonth: string
    readonly batch: string
    readonly batchHint: string
    readonly hourFrom: string
    readonly hourTo: string
    readonly publicTitle: string
    readonly publicHint: string
    readonly publicOn: string
    readonly publicLink: string
    readonly copy: string
    readonly copied: string
    readonly save: string
}

/** The error of one tier row, when its fields do not hold. */
export interface TierErrorView {
    readonly name?: string | undefined
    readonly minSpend?: string | undefined
}
