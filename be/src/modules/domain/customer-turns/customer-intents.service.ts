import { Injectable, type OnModuleInit } from "@nestjs/common"
import { AgentPluginsService } from "@modules/domain/agent-plugins"
import { CUSTOMER_PLUGIN } from "./customer-intents.policy"

@Injectable()
/** Registers the customer reply as a plug-in of the agent core when the module starts, the way a wake source registers its handlers. */
export class CustomerIntentsService implements OnModuleInit {
    constructor(private readonly plugins: AgentPluginsService) {}

    /** Adds the manifest of the customer reply. */
    onModuleInit(): void {
        this.plugins.add(CUSTOMER_PLUGIN)
    }
}
