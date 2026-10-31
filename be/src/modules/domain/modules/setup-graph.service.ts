import { Injectable, Optional } from "@nestjs/common"
import { InjectSetupGraph } from "./modules.decorators"
import type { SetupApplier, SetupGraphPort } from "./modules.port"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"

@Injectable()
/**
 * What the setup chat asks of the action graph, and nothing when the app has none: the first vague place for the prompt of a turn, the
 * check that the setup is not applied while the flow is still vague, and the publish of the draft of the graph with the version the setup
 * became. With no graph bound each call answers as if the flow were whole.
 */
export class SetupGraphService {
    constructor(@Optional() @InjectSetupGraph() private readonly graph: SetupGraphPort | null = null) {}

    /** The code of the first vague place of the graph of the installation, or null when it has none or there is no graph. */
    async gapOf(workspaceId: string, installationId: string): Promise<string | null> {
        const code = (await this.graph?.firstGap(workspaceId, installationId)) ?? ""
        return code === "" ? null : code
    }

    /** Refuses the apply while the flow is still vague. */
    async requireWhole(workspaceId: string, installationId: string): Promise<void> {
        if ((await this.gapOf(workspaceId, installationId)) !== null)
            throw new ModulesError({ code: ModulesErrorCode.GraphGapsOpen })
    }

    /** Publishes the draft of the graph with the version the setup became; nothing without a graph. */
    async publish(applier: SetupApplier): Promise<void> {
        await this.graph?.publish(applier)
    }

    /** The seat of the person the owner named, or null when nobody is found or there is no graph. */
    async seatNamed(workspaceId: string, name: string): Promise<string | null> {
        const seat = (await this.graph?.seatNamed(workspaceId, name)) ?? ""
        return seat === "" ? null : seat
    }
}
