import { Injectable, Optional } from "@nestjs/common"
import { InjectSetupGraph } from "./modules.decorators"
import type { SetupApplicant, SetupApplier, SetupGraphPort } from "./modules.port"

@Injectable()
/**
 * What the setup chat asks of the action graph, and nothing when the app has none: the check that the graph would take the publish, and
 * the publish of the draft of the graph with the version the setup became.
 */
export class SetupGraphService {
    constructor(@Optional() @InjectSetupGraph() private readonly graph: SetupGraphPort | null = null) {}

    /** Refuses before anything is written when the graph would refuse the publish; answers the newest graph version number, 0 without a graph. */
    async checkPublish(applicant: SetupApplicant): Promise<number> {
        return (await this.graph?.checkPublish(applicant)) ?? 0
    }

    /** Publishes the draft of the graph as the version the setup became; nothing without a graph. */
    async publish(applier: SetupApplier): Promise<void> {
        await this.graph?.publish(applier)
    }

    /** Asks the graph for the contracts and gaps the applied setup calls for; none without a graph. */
    async proposeContracts(applier: SetupApplier): Promise<number> {
        return (await this.graph?.proposeContracts(applier)) ?? 0
    }
}
