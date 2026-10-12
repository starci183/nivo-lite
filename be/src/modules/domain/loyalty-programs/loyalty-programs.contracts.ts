/** One rung of the loyalty ladder: the spend that reaches it and what it gives. */
export interface LoyaltyTier {
    /** The stable key of the tier, unique inside a programme. */
    readonly key: string
    /** The name shown to customers. */
    readonly name: string
    /** The lifetime spend in VND that reaches the tier. */
    readonly minSpendVnd: number
    /** The factor applied to the points earned by spend. */
    readonly multiplier: number
    /** The days without a visit after which the win-back message goes out. */
    readonly winbackDays: number
    /** What the tier gives, in the owner's words. */
    readonly benefit: string
}

/** A rate for the items whose text contains `match`. */
export interface LoyaltyCategoryRule {
    /** The word to look for in the items of an order, accents and case ignored. */
    readonly match: string
    /** The points per thousand VND spent on it. */
    readonly perThousandVnd: number
    /** The label shown with the earned points. */
    readonly label: string
}

/** The numbers and rules of a loyalty programme. */
export interface LoyaltyConfig {
    /** How points are earned. */
    readonly earn: {
        /** The points per thousand VND spent. */
        readonly perThousandVnd: number
        /** The points added to every visit. */
        readonly perVisit: number
        /** The better rates of some items. */
        readonly categories: ReadonlyArray<LoyaltyCategoryRule>
        /** The event that earns points: a payment or a confirmed order. */
        readonly trigger: "payment" | "order"
        /** The smallest order that earns points, in VND. */
        readonly minOrderVnd: number
    }
    /** The ladder, lowest rung first. */
    readonly tiers: ReadonlyArray<LoyaltyTier>
    /** When earned points expire. */
    readonly expiry: {
        /** The months after which points expire, zero for never. */
        readonly months: number
        /** The days before expiry at which the customer is warned. */
        readonly warnDays: number
    }
    /** The birthday gift. */
    readonly birthday: {
        /** Whether the gift is on. */
        readonly enabled: boolean
        /** The bonus points. */
        readonly points: number
        /** The key of a reward given as well, or empty. */
        readonly rewardKey: string
        /** The note of the owner. */
        readonly note: string
    }
    /** How promotions may be sent. */
    readonly promo: {
        /** The most promotions one customer receives in 30 days. */
        readonly maxPerMonth: number
        /** The earliest time of day a promotion goes out, `HH:MM`. */
        readonly hourFrom: string
        /** The latest time of day a promotion goes out, `HH:MM`. */
        readonly hourTo: string
        /** The most promotions sent in one tick. */
        readonly batch: number
    }
}

/** The loyalty programme of one workspace. */
export interface LoyaltyProgram {
    /** The workspace. */
    readonly workspaceId: string
    /** The slug of the public points page. */
    readonly slug: string
    /** The name of the programme. */
    readonly name: string
    /** Whether the programme is on. */
    readonly enabled: boolean
    /** The rules, resolved over the defaults. */
    readonly config: LoyaltyConfig
    /** When the programme was created, ISO 8601. */
    readonly createdAt: string
}
