import { Injectable } from "@nestjs/common"
import { ActionPerformerRegistry } from "@modules/domain/module-ops"
import type { ActionPerformer } from "@modules/domain/module-ops"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "./decisions.contracts"
import { performContextOf, performedOf } from "./module-gate.policy"
import { InjectWorkPerformerRegistry } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"

/** A module performer as the work engine calls it: the proposal is preset, perform maps the result, a refusal runs the undo. */
const asWorkPerformer = (performer: ActionPerformer): WorkPerformer => ({
    prepare: (_ctx: WorkContext, item: WorkItem): Promise<Prepared> => Promise.resolve({ proposal: item.proposal }),
    perform: async (ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> =>
        performedOf(item, await performer.perform(performContextOf(ctx, item, proposal, by))),
    onReject: async (ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void> => {
        await performer.reject?.(performContextOf(ctx, item, proposal, by))
    },
})

@Injectable()
/**
 * The performer registry of the business modules (hiring, shifts, inventory). Every performer a module adds at boot is also
 * registered with the work engine, so a waiting item decided after a restart still finds its performer.
 */
export class ModulePerformersService extends ActionPerformerRegistry {
    private readonly performers = new Map<string, ActionPerformer>()

    constructor(@InjectWorkPerformerRegistry() private readonly engine: WorkPerformerRegistry) {
        super()
    }

    /** Registers a performer here and with the work engine; a second performer of the same action replaces the first. */
    override add(performer: ActionPerformer): void {
        this.performers.set(performer.action, performer)
        this.engine.add(performer.action, asWorkPerformer(performer))
    }

    /** The performers registered for an action: one, or none when no module registered one. */
    override performersOf(action: string): ReadonlyArray<ActionPerformer> {
        const performer = this.performers.get(action)
        return performer === undefined ? [] : [performer]
    }
}
