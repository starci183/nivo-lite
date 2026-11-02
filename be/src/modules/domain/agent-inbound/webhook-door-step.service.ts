import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import { IntentRequestDoorService } from "@modules/domain/agent-turns"
import { genericWebhookAdapter } from "./generic-webhook.adapter"

@Injectable()
/** Registers the webhook adapter's durable door without granting its untrusted sender write authority. */
export class WebhookDoorStepService implements OnModuleInit {
    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly requests: IntentRequestDoorService,
    ) {}

    /** Binds the adapter's declared step kind to the authoritative contract request path. */
    onModuleInit(): void {
        this.handlers.add({ kind: genericWebhookAdapter.doorStep, run: (step) => this.requests.apply(step) })
    }
}
