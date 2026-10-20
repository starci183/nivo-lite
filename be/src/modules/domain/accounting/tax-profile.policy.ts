import type { OptionalTaxProfile, SupplierOnFile, WorkspaceFact } from "./accounting-desk.contracts"

/** The Second Brain subject that holds the workspace tax profile (seeded and confirmed by the chief accountant). */
export const TAX_PROFILE_SUBJECT = "tax_profile"
/** The prefix of the Second Brain subjects that hold one supplier each (`supplier:<slug>`). */
export const SUPPLIER_SUBJECT_PREFIX = "supplier:"

const valueOf = (facts: ReadonlyArray<WorkspaceFact>, subject: string, attribute: string): string | undefined =>
    facts.find((fact) => fact.subjectKey === subject && fact.attribute === attribute)?.value.trim()

const numberOf = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value)
    return value === undefined || value === "" || Number.isNaN(parsed) ? fallback : parsed
}

const flagOf = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) return fallback
    return ["true", "yes", "co", "1"].includes(value.toLowerCase())
}

/**
 * The tax profile read from the active Second Brain facts of subject `tax_profile`: `tax_code` is required; `vat_period`
 * (`monthly` | `quarterly`, default quarterly), `withholds_pit`, `pays_license_fee`, `established_year`, `reminder_days` (7) and
 * `supplier_term_days` (30) are optional. Null when the workspace has no tax code on file.
 */
export const taxProfileOf = (facts: ReadonlyArray<WorkspaceFact>): OptionalTaxProfile => {
    const read = (attribute: string): string | undefined => valueOf(facts, TAX_PROFILE_SUBJECT, attribute)
    const taxCode = read("tax_code")
    if (taxCode === undefined || taxCode === "") return null
    return {
        taxCode,
        vatPeriod: read("vat_period") === "monthly" ? "monthly" : "quarterly",
        withholdsPit: flagOf(read("withholds_pit"), true),
        paysLicenseFee: flagOf(read("pays_license_fee"), true),
        establishedYear: numberOf(read("established_year"), 0),
        reminderDays: numberOf(read("reminder_days"), 7),
        supplierTermDays: numberOf(read("supplier_term_days"), 30),
    }
}

/** The suppliers on file read from the Second Brain subjects `supplier:<slug>` (`name`, `tax_code`, optional `term_days`). */
export const suppliersOf = (facts: ReadonlyArray<WorkspaceFact>): Array<SupplierOnFile> => {
    const subjects = [...new Set(facts.map((fact) => fact.subjectKey))].filter((key) =>
        key.startsWith(SUPPLIER_SUBJECT_PREFIX),
    )
    return subjects.flatMap((subject) => {
        const taxCode = valueOf(facts, subject, "tax_code")
        if (taxCode === undefined || taxCode === "") return []
        const term = valueOf(facts, subject, "term_days")
        return [
            {
                name: valueOf(facts, subject, "name") ?? subject.slice(SUPPLIER_SUBJECT_PREFIX.length),
                taxCode,
                termDays: term === undefined ? null : numberOf(term, 0),
            },
        ]
    })
}
