/** The values of the reward form: numbers are typed as digits and parsed on save. */
export interface RewardFormValues {
    name: string
    kind: string
    cost: string
    value: string
    percent: string
    stock: string
    limit: string
    minTier: string
    note: string
    active: boolean
}

/** The string fields of the form: what a typed value is masked for. */
export type RewardTextField = "name" | "kind" | "cost" | "value" | "percent" | "stock" | "limit" | "minTier" | "note"
