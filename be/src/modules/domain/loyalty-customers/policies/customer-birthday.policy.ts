import type { CustomerBirthday } from "../loyalty-customers.contracts"

/** A real calendar date for a profile birthday, or null for an empty or invalid date. */
export const customerBirthday = (value: CustomerBirthday): CustomerBirthday => {
    if (value === null || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
