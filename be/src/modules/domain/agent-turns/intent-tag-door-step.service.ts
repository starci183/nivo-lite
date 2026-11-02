import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import { IntentRequestDoorService } from "./intent-request-door.service"
import { INTENT_STEP_KIND } from "./intent-turn.policy"

@Injectable()
/** Registers the tag adapter's durable door with the common contract request application. */
export class IntentTagDoorStepService implements OnModuleInit {
    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly requests: IntentRequestDoorService,
    ) {}

    /** Registers the door with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add({ kind: INTENT_STEP_KIND.tagDoor, run: (step) => this.requests.apply(step) })
    }
}
