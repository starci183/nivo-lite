/** A plan as the credits page shows it. */
export class PlanViewResponse {
    /** The plan code. */
    code!: string
    /** The Vietnamese name. */
    nameVi!: string
    /** The English name. */
    nameEn!: string
    /** Monthly credits; null is unlimited. */
    credits!: number | null
    /** The price in VND. */
    price!: number
    /** VND per monthly credit. */
    perCredit!: number
    /** The seats. */
    seats!: number
    /** A contract plan. */
    isCustom!: boolean
}

/** A pack as the credits page shows it. */
export class PackViewResponse {
    /** The pack code. */
    code!: string
    /** The credits. */
    credits!: number
    /** The price in VND. */
    price!: number
    /** VND per credit. */
    perCredit!: number
    /** How much cheaper than the smallest pack, whole percent. */
    discountPct!: number
}

/** Why a plan is recommended: `topups`, `cheaper` or `plain`, with the figures of that reason. */
export class UpgradeReasonResponse {
    /** `topups`, `cheaper` or `plain`. */
    kind!: string
    /** Top-up credits bought lately (kind topups). */
    credits?: number
    /** Monthly VND saved (kind topups). */
    saving?: number
    /** Whole percent cheaper per credit (kind cheaper). */
    pct?: number
}

/** The plan recommended next and why. */
export class NextPlanResponse {
    /** The plan. */
    plan!: PlanViewResponse
    /** Why it is recommended. */
    reason!: UpgradeReasonResponse
}

/** The contract plan shown instead of an upgrade. */
export class ContactResponse {
    /** The contract plan, when any. */
    plan!: PlanViewResponse | null
}

/** One payment order as the credits page lists it. */
export class OrderLineResponse {
    /** The order id. */
    id!: string
    /** `plan`, `upgrade` or `topup`. */
    kind!: string
    /** The plan code on the order. */
    planCode!: string
    /** The credits of a top-up, or null. */
    packCredits!: number | null
    /** The amount in VND. */
    amount!: number
    /** When it was created, ISO 8601. */
    createdAt!: string
    /** `pending`, `paid`, `expired` or `cancelled`. */
    status!: string
    /** The transfer content. */
    code!: string
}

/** The bank account customers pay into. */
export class OverviewBankResponse {
    /** The account number. */
    account!: string
    /** The bank short code. */
    bank!: string
    /** The account holder. */
    holder!: string
}

/** Everything the credits page needs for one workspace. */
export class CreditsOverviewResponse {
    /** Owner and manager may buy. */
    canBuy!: boolean
    /** The end of the paid period, ISO 8601, or null. */
    paidUntil!: string | null
    /** The workspace status. */
    workspaceStatus!: string
    /** The plan of the workspace, or null. */
    plan!: PlanViewResponse | null
    /** Credits spent this month. */
    used!: number
    /** This month's allowance; null is unlimited. */
    limit!: number | null
    /** Credits carried over. */
    carried!: number
    /** Top-up credits spendable now. */
    topup!: number
    /** The soonest date some top-up credits expire, ISO 8601, or null. */
    topupExpires!: string | null
    /** YYYY-MM-DD the allowance runs out this month, or null. */
    runout!: string | null
    /** The packs on sale. */
    packs!: ReadonlyArray<PackViewResponse>
    /** The self-serve plans. */
    plans!: ReadonlyArray<PlanViewResponse>
    /** The next plan up, or null. */
    next!: NextPlanResponse | null
    /** Shown instead of an upgrade on the top plans. */
    contact!: ContactResponse | null
    /** The latest payment orders. */
    orders!: ReadonlyArray<OrderLineResponse>
    /** The bank account customers pay into. */
    bank!: OverviewBankResponse
}
