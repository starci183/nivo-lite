import type { FairnessViolation, TextOf } from "../hiring.contracts"
import { QUOTED_VIOLATIONS } from "./fairness.policy"

/** One found phrase as the owner reads it: where it is, the words and the trait. */
const quote = (violation: FairnessViolation, textOf: TextOf): string => {
    const field = violation.field === "" ? "" : `${textOf(`hiring.field.${violation.field}`, {})}: `
    return `${field}"${violation.excerpt}" (${textOf(`hiring.fairness.${violation.category}`, {})})`
}

/** The refusal shown to the owner: what was found, where, and what to write instead. */
export const fairnessMessage = (violations: ReadonlyArray<FairnessViolation>, textOf: TextOf): string => {
    const parts = violations.slice(0, QUOTED_VIOLATIONS).map((violation) => quote(violation, textOf))
    const more =
        violations.length > QUOTED_VIOLATIONS
            ? textOf("hiring.fairness.more", { count: violations.length - QUOTED_VIOLATIONS })
            : ""
    return textOf("hiring.fairness.refusal", {
        parts: parts.join("; "),
        more,
        advice: textOf("hiring.fairness.advice", {}),
    })
}
