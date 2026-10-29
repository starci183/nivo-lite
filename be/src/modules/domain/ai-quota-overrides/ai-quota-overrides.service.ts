import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CreditsLimit } from "./ai-quota-overrides.contracts"
import { AiQuotaOverrideEntity } from "./persistence/entities"

@Injectable()
/** The per-workspace AI allowances that differ from the plan's: the only writer of public.ai_quota_overrides. */
export class AiQuotaOverridesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Gives the workspace its own monthly credits; null clears them so the plan's allowance applies. */
    async setCreditsLimit(workspaceId: string, creditsLimit: CreditsLimit): Promise<void> {
        await this.entityManager.upsert(
            AiQuotaOverrideEntity,
            {
                workspaceId,
                creditsLimit: creditsLimit === null ? null : String(creditsLimit),
                updatedAt: this.clock.now(),
            },
            ["workspaceId"],
        )
    }
}
