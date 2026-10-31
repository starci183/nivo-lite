import { amountRules } from "./amounts.policy"
import { citationRules } from "./citations.policy"
import type { ReviewContext, RuleOutput } from "./dossier-inputs.contracts"
import { expiryRules } from "./expiry.policy"
import { factConflictRules } from "./facts-conflict.policy"
import { coverageKey } from "./fingerprint.policy"
import { identifierRules } from "./identifiers.policy"
import { outdatedRules } from "./outdated.policy"
import { presenceRules } from "./presence.policy"
import { roleRules } from "./roles.policy"
import type { RuleFamily } from "./rule-kit.policy"
import { signatureRules } from "./signatures.policy"
import { valueRules } from "./values.policy"

/** Every rule key of the pack: each counts as evaluated for every dossier of a pass. */
export const RULE_KEYS = [
    "presence.expected",
    "presence.dossier",
    "signatures.unsigned",
    "signatures.placeholders",
    "expiry.dates",
    "expiry.untracked",
    "amounts.invariant",
    "amounts.contribution",
    "amounts.shares",
    "outdated.after_event",
    "roles.holders",
    "roles.left",
    "facts.conflict",
    "identifiers.canonical",
    "citations.repealed",
    "values.minimum_wage",
    "values.dates",
] as const

const FAMILIES: ReadonlyArray<RuleFamily> = [
    presenceRules,
    signatureRules,
    expiryRules,
    amountRules,
    outdatedRules,
    roleRules,
    factConflictRules,
    identifierRules,
    citationRules,
    valueRules,
]

/** Runs every rule family over the dossiers of a pass: the candidates they find and the (rule, dossier) pairs they evaluated. */
export const runRules = (context: ReviewContext): RuleOutput => ({
    candidates: FAMILIES.flatMap((family) => family(context)),
    coverage: context.dossiers.flatMap((inputs) => RULE_KEYS.map((key) => coverageKey(key, inputs.dossier.id))),
})
