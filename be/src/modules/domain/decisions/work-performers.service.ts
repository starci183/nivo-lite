import { Injectable } from "@nestjs/common"
import type { OptionalWorkPerformer, WorkPerformer } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import type { WorkPerformerRegistry } from "./work-performer.port"

@Injectable()
/** The performer of each action: capabilities register theirs at boot, the engine looks one up per item. */
export class WorkPerformersService implements WorkPerformerRegistry {
    private readonly performers = new Map<string, WorkPerformer>()

    /** Registers the performer of an action; a second registration of the same action replaces the first. */
    add(action: string, performer: WorkPerformer): void {
        this.performers.set(action, performer)
    }

    /**
     * The performer registered for an action, or null when the action only records the decision. A registry nobody filled means the
     * registrars did not run, so no action may be closed as only recorded: that fails loudly instead of marking unsent work done.
     */
    performerOf(action: string): OptionalWorkPerformer {
        if (this.performers.size === 0) {
            throw new DecisionsError({ code: DecisionsErrorCode.NoPerformer, params: { action } })
        }
        return this.performers.get(action) ?? null
    }
}
