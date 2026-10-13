/** The text fields of the programme form that sit at its top level. */
export type ProgramTextField =
    | "name"
    | "perThousand"
    | "perVisit"
    | "minOrder"
    | "trigger"
    | "expiryMonths"
    | "warnDays"
    | "birthdayPoints"
    | "birthdayReward"
    | "birthdayNote"
    | "maxPerMonth"
    | "hourFrom"
    | "hourTo"
    | "batch"

/** The switches of the programme form. */
export type ProgramSwitchField = "enabled" | "birthdayOn"

/** The text fields of one tier a manager types into. */
export type TierTextField = "name" | "minSpend" | "multiplier" | "winback" | "benefit"

/** The text fields of one category rule. */
export type CategoryTextField = "match" | "rate" | "label"

const decimal = (value: string): string => value.replace(/[^\d.,]/g, "").slice(0, 8)
const whole = (value: string, max = 12): string => value.replace(/[^\d]/g, "").slice(0, max)
const clock = (value: string): string => value.replace(/[^\d:]/g, "").slice(0, 5)

/** A typed value masked for its top-level field: numbers keep only digits, texts are cut to their limits. */
export const maskProgramField = (field: ProgramTextField, value: string): string => {
    if (field === "name") return value.slice(0, 60)
    if (field === "perThousand") return decimal(value)
    if (field === "perVisit" || field === "minOrder" || field === "birthdayPoints") return whole(value)
    if (field === "trigger") return value === "order" ? "order" : "payment"
    if (field === "expiryMonths" || field === "warnDays" || field === "batch") return whole(value, 3)
    if (field === "maxPerMonth") return whole(value, 2)
    if (field === "birthdayReward") return value === "none" ? "" : value
    if (field === "birthdayNote") return value.slice(0, 200)
    return clock(value)
}

/** A typed value masked for a tier field. */
export const maskTierField = (field: TierTextField, value: string): string => {
    if (field === "name") return value.slice(0, 30)
    if (field === "multiplier") return decimal(value)
    if (field === "minSpend") return whole(value)
    if (field === "winback") return whole(value, 3)
    return value.slice(0, 200)
}

/** A typed value masked for a category field. */
export const maskCategoryField = (field: CategoryTextField, value: string): string =>
    field === "rate" ? decimal(value) : value.slice(0, 40)
