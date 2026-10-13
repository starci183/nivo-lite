import type { LeadView } from "@modules/domain/leads"

/** A board lead with the owner and next action of its oldest open step. */
export interface LeadBoardItem extends LeadView {
    /** The display name of the next step's owner, or null. */
    readonly ownerName: string | null
    /** The next action, or null before a step is assigned. */
    readonly nextAction: string | null
}
