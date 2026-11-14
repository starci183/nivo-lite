import { createHash } from "node:crypto"
import type { FindingEvidence } from "./dossier-review.contracts"

const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 32)

/** A text compared without composition, case or repeated whitespace. */
export const normalizeQuote = (text: string): string => text.normalize("NFC").replaceAll(/\s+/gu, " ").trim().toLowerCase()

/** What the evidence was, ignoring labels and roles: a dismissed point re-detected with a different hash reopens. */
export const evidenceHashOf = (evidence: ReadonlyArray<FindingEvidence>): string =>
    hashOf(
        JSON.stringify(
            evidence
                .map((item) => [item.sourceId, item.passageId, item.factId, item.quote])
                .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)),
        ),
    )
