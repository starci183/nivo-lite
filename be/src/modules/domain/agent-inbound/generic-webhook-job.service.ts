import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isGenericWebhookPayload } from "@modules/queues/generic-webhook"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { normalizeGenericWebhook } from "./generic-webhook.adapter"
import { InboundDoorService } from "./inbound-door.service"

/** Tells the queue that no retry can change the outcome. */
const UNRECOVERABLE = { unrecoverable: 1 } as const

@Injectable()
/**
 * The door of the generic-webhook job into the agents: the receipt of one verified delivery is read back, its endpoint names the workspace,
 * the delivery becomes the inbound event it is and goes to the door in one transaction. A redelivered job finds its wake written already and
 * writes nothing. A receipt that is not one, or an endpoint that is gone, ends the job with no retry, since no retry could change it.
 */
export class GenericWebhookJobService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly secrets: ConnectionSecretReadsService,
        private readonly door: InboundDoorService,
    ) {}

    /** Delivers the event a job names. */
    async run(job: object): Promise<void> {
        if (!isGenericWebhookPayload(job)) {
            throw new AgentInboundError({ code: AgentInboundErrorCode.JobPayloadInvalid, params: UNRECOVERABLE })
        }
        const secret = await this.secrets.secretOf(job.connectionId, "webhook")
        if (secret.kind !== "ok") {
            throw new AgentInboundError({ code: AgentInboundErrorCode.EndpointUnknown, params: UNRECOVERABLE })
        }
        const event = normalizeGenericWebhook({
            workspaceId: secret.value.workspaceId,
            connectionId: job.connectionId,
            rawBody: Buffer.from(job.rawBody, "utf8"),
            eventType: job.eventType ?? undefined,
            deliveryKey: job.deliveryKey ?? undefined,
        })
        await this.entityManager.transaction((tx) => this.door.accept(tx, { ...event, idempotencyKey: job.deliveryId }))
    }
}
