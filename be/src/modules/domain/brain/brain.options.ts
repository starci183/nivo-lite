import type { Type } from "@nestjs/common"
import type { CorrectionSource } from "./brain.contracts"

/** What the brain capability needs from the composition root. */
export interface BrainOptions {
    /** Where the owner's corrections of the agents' work come from; the decisions capability provides it. */
    readonly corrections: Type<CorrectionSource>
}
