import type { FairnessField, FairnessViolation, TextOf } from "../hiring.contracts"
import { QUOTED_VIOLATIONS } from "./fairness.policy"

/** The catalog key of the name of a part of a job. */
const fieldKey = (field: FairnessField): `hiring.field.${FairnessField}` => `hiring.field.${field}`

/** One found phrase as the owner reads it: where it is, the words and the trait. */
const quote = (violation: FairnessViolation, t: TextOf): string => {
    const field = violation.field === "" ? "" : `${t(fieldKey(violation.field), {})}: `
    return `${field}"${violation.excerpt}" (${t(`hiring.fairness.${violation.category}`, {})})`
}

/** The refusal shown to the owner: what was found, where, and what to write instead. */
export const fairnessMessage = (violations: ReadonlyArray<FairnessViolation>, t: TextOf): string => {
    const parts = violations.slice(0, QUOTED_VIOLATIONS).map((violation) => quote(violation, t))
    const more =
        violations.length > QUOTED_VIOLATIONS
            ? t("hiring.fairness.more", { count: violations.length - QUOTED_VIOLATIONS })
            : ""
    return t("hiring.fairness.refusal", {
        parts: parts.join("; "),
        more,
        advice: t("hiring.fairness.advice", {}),
    })
}
