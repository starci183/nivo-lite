import { Injectable } from "@nestjs/common"
import { TRIGGER_SOURCE_KINDS } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { ProviderTriggersService, triggerDeclarations } from "@modules/domain/provider-triggers"
import { verbOfSource } from "@modules/domain/trigger-specs"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ConversationsLogEvent } from "./conversations.log-events"

/** The `resume` member of the event that follows a person's hand-back (`trigger.data.resume`). */
export const RESUME_HELD = "held"

/**
 * The data of the hand-back's event, in the shape every customer channel's declaration gives its line (ROAD-API section 6): no words, no
 * key, no pictures, and `resume`. The channel's declaration parses it like any line; a declaration that does not take it drops it.
 */
const RESUME_DATA = { messageKey: "", text: "", at: null, attachments: [], resume: RESUME_HELD } as const

@Injectable()
/**
 * The answer to what a customer wrote while a person held their conversation (D-MX-7; the release door, D7 of the one event pipeline).
 * A customer line heard during a take-over is kept by the front desk's own first step and starts no answer (the person answers it
 * themselves). When the person hands the conversation back, ONE event of the route's channel verb is delivered through the one delivery
 * function, with no words and `data.resume = "held"`, on the person's route and account: the registration of the agent the account is
 * attached to takes it like any line, its first step reads the lines no reply followed in its own records and answers them as one turn.
 * The engine reads no conversation and names no front door to do it. A hand-back that names no route, or a route of an entrance with no
 * account, wakes nobody.
 */
export class HeldLinesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly routes: CustomerRoutesService,
        private readonly triggers: ProviderTriggersService,
    ) {}

    /**
     * Delivers the hand-back's event once; answers how many wakes it wrote (0 when the id names no route, its entrance has no account, its
     * channel has no registered declaration, or no registration takes it). In the caller's transaction when it hands one (the hand-back's
     * one transaction, ruling R51 item 3), else in its own.
     */
    async answerHeld(workspaceId: string, conversationId: string, manager?: EntityManager): Promise<number> {
        const route = await this.routes.get(workspaceId, conversationId)
        if (route === null || route.accountId === null) {
            // A route not found (its contact erased, owner ruling R31) or of no account: nothing to hand back, said once (R37).
            this.logger.info(ConversationsLogEvent.ResumeNoRoute, { workspaceId, routeId: conversationId, found: route !== null })
            return 0
        }
        const { accountId } = route
        const kind = TRIGGER_SOURCE_KINDS.find((one) => one === route.channel)
        const verb = kind === undefined ? null : verbOfSource({ kind, connectionId: null })
        const declaration = verb === null ? undefined : triggerDeclarations.ofVerb(verb)[0]
        if (declaration === undefined) {
            this.logger.warn(ConversationsLogEvent.ResumeUndeclared, { workspaceId, channel: route.channel })
            return 0
        }
        const delivered = (tx: EntityManager) =>
            this.triggers.deliver(
                {
                    workspaceId,
                    declaration,
                    connectionId: accountId,
                    agentId: null,
                    events: [
                        {
                            event: { id: `resume:${route.id}:${this.clock.now().getTime()}`, data: RESUME_DATA },
                            contactId: route.contactId,
                            routeId: route.id,
                        },
                    ],
                },
                tx,
            )
        const result = manager === undefined ? await this.entityManager.transaction(delivered) : await delivered(manager)
        return result.status === "delivered" ? result.woken.length : 0
    }
}
