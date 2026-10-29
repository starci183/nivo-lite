import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService, isManagerRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { GenerationEnqueued, GuideAsk, GuideWords } from "./ai-generations.contracts"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationsService } from "./generations.service"
import { GUIDE_ASKS_PER_WINDOW, GUIDE_TIMEOUT_MS, GUIDE_WINDOW_MS, guideAskerKey, guidePrompt } from "./guide.policy"
import { AiGenerationEntity } from "./persistence/entities"

@Injectable()
/**
 * The NIVO guide's door to the model. The be builds the prompt from the catalog (only the pages the member's role may open), queues it
 * as a standard generation under the usage kind `guide` (paid by NIVO, never counted toward the workspace allowance) and answers the id
 * the status query polls. Each member may ask the model `GUIDE_ASKS_PER_WINDOW` times per window, counted in the database so the limit
 * holds across API instances.
 */
export class GuideService {
    constructor(
        private readonly generations: GenerationsService,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** Queues the model answer of one guide question, or refuses with `GuideRateLimited` when the member asked too often. */
    async ask(userId: string, ask: GuideAsk): Promise<GenerationEnqueued> {
        const member = await this.members.require(userId, ask.workspaceId)
        const words: GuideWords = { text: (key) => this.catalog.get(key, {}, ask.locale) }
        const messages = guidePrompt(ask, isManagerRole(member.role), words)
        const since = new Date(this.clock.now().getTime() - GUIDE_WINDOW_MS)
        return this.entityManager.transaction(async (tx) => {
            await advisoryXactLock(tx, guideAskerKey(ask.workspaceId, userId))
            const asked = await tx
                .createQueryBuilder(AiGenerationEntity, "g")
                .where("g.workspace_id = :workspaceId AND g.usage_kind = 'guide' AND g.created_at >= :since", {
                    workspaceId: ask.workspaceId,
                    since,
                })
                .andWhere("g.input -> 'context' ->> 'requestedBy' = :userId", { userId })
                .getCount()
            if (asked >= GUIDE_ASKS_PER_WINDOW) {
                throw new AiGenerationsError({ code: AiGenerationsErrorCode.GuideRateLimited })
            }
            return this.generations.request(
                {
                    workspaceId: ask.workspaceId,
                    purpose: "guide",
                    messages,
                    responseFormat: "json",
                    timeoutMs: GUIDE_TIMEOUT_MS,
                    kind: "guide",
                    module: "other",
                    locale: ask.locale,
                },
                { requestedBy: userId },
                tx,
            )
        })
    }
}
