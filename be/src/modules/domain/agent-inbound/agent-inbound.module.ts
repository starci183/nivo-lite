import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GenericWebhookQueueModule } from "@modules/queues/generic-webhook"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { GenericWebhookIntakeService } from "./generic-webhook-intake.service"
import { GenericWebhookProofService } from "./generic-webhook-proof.service"
import { InboundAdapterRegistryService } from "./inbound-adapter-registry.service"
import { GenericWebhookJobService } from "./generic-webhook-job.service"
import { InboundDoorService } from "./inbound-door.service"
import { INBOUND_ADAPTER_REGISTRY, INBOUND_STOP_REPORTER } from "./agent-inbound.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-inbound.module-definition"

@Module({})
/**
 * The one door that wakes an agent: the registry adapters add themselves to, the door that writes the wake and opens its run in the caller's
 * transaction. A wake it writes is run by a workflow whose trigger takes it, or held. It owns no table: a wake is a row of agent-work, a run is a
 * row of agent-runs. The capability that can tell a person a chain of agents stopped binds the stop reporter.
 */
export class AgentInboundModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), GenericWebhookQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                ...(options.stopReporter === undefined
                    ? []
                    : [{ provide: INBOUND_STOP_REPORTER, useExisting: options.stopReporter }]),
                InboundAdapterRegistryService,
                { provide: INBOUND_ADAPTER_REGISTRY, useExisting: InboundAdapterRegistryService },
                InboundDoorService,
                GenericWebhookProofService,
                GenericWebhookIntakeService,
                GenericWebhookJobService,
            ],
            exports: [
                INBOUND_ADAPTER_REGISTRY,
                InboundDoorService,
                GenericWebhookIntakeService,
                GenericWebhookJobService,
            ],
        }
    }
}
