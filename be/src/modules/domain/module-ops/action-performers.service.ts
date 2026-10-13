import { Injectable } from "@nestjs/common"
import { ActionPerformerRegistry } from "./action-performer.port"
import type { ActionPerformer } from "./action-performer.port"

@Injectable()
/** The registry the modules add their performers to and the approval gate reads: one performer per gated action. */
export class ActionPerformersService extends ActionPerformerRegistry {
    private readonly performers = new Map<string, ActionPerformer>()

    /** Registers a performer; a second performer of the same action replaces the first. */
    override add(performer: ActionPerformer): void {
        this.performers.set(performer.action, performer)
    }

    /** The performers registered for an action: one, or none when no module registered one. */
    override performersOf(action: string): ReadonlyArray<ActionPerformer> {
        const performer = this.performers.get(action)
        return performer === undefined ? [] : [performer]
    }
}
