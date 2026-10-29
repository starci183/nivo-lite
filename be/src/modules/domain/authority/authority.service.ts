import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { mergeAuthority } from "./authority.policy"
import type {
    AuthorityPatch,
    AuthorityProfile,
    AuthorityScope,
    OptionalAuthority,
    OptionalAuthorityProfile,
} from "./authority.contracts"
import { AuthorityError, AuthorityErrorCode } from "./errors/authority.error"
import { AuthorityEntity } from "./persistence/entities"

const profileOf = (entity: AuthorityEntity): AuthorityProfile => ({
    policies: entity.policies,
    reply_style: entity.replyStyle,
    brand_voice: entity.brandVoice,
    limits_note: entity.limitsNote,
    goal_revenue_vnd: entity.goalRevenueVnd === null ? null : Number(entity.goalRevenueVnd),
    goal_new_customers: entity.goalNewCustomers,
    goal_first_reply_minutes: entity.goalFirstReplyMinutes,
    goal_note: entity.goalNote,
    updated_by: entity.updatedBy,
    updated_at: entity.updatedAt.toISOString(),
})

@Injectable()
/** The owner's goals and house rules: the only owner of the authority table. */
export class AuthorityService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The house rules the prompts carry; null before the owner set any. */
    async load(scope: AuthorityScope): Promise<OptionalAuthority> {
        const row = await this.entityManager.findOne(AuthorityEntity, {
            select: { policies: true, replyStyle: true, brandVoice: true, limitsNote: true },
            where: { workspaceId: scope.workspaceId },
        })
        if (row === null) return null
        return {
            policies: row.policies,
            reply_style: row.replyStyle,
            brand_voice: row.brandVoice,
            limits_note: row.limitsNote,
        }
    }

    /** The whole sheet the Authority page edits; null before the owner set any. */
    async profileOf(workspaceId: string): Promise<OptionalAuthorityProfile> {
        const row = await this.entityManager.findOne(AuthorityEntity, { where: { workspaceId } })
        return row === null ? null : profileOf(row)
    }

    /** Creates the empty sheet of a workspace that has none; true only when this call created it (a concurrent call answers false). */
    async ensureSheet(workspaceId: string): Promise<boolean> {
        const created = await this.entityManager
            .createQueryBuilder(AuthorityEntity, "a")
            .insert()
            .values({ workspaceId, updatedBy: "NIVO" })
            .orIgnore()
            .returning("workspace_id")
            .execute()
        return Array.isArray(created.raw) && created.raw.length > 0
    }

    /** Lays the patch over the stored sheet and saves the result, stamped with who saved it. */
    async save(workspaceId: string, patch: AuthorityPatch, updatedBy: string): Promise<AuthorityProfile> {
        const next = mergeAuthority(await this.profileOf(workspaceId), patch)
        await this.entityManager.upsert(
            AuthorityEntity,
            {
                workspaceId,
                policies: next.policies,
                replyStyle: next.reply_style,
                brandVoice: next.brand_voice,
                limitsNote: next.limits_note,
                goalRevenueVnd: next.goal_revenue_vnd === null ? null : String(next.goal_revenue_vnd),
                goalNewCustomers: next.goal_new_customers,
                goalFirstReplyMinutes: next.goal_first_reply_minutes,
                goalNote: next.goal_note,
                updatedBy,
                updatedAt: () => "now()",
            },
            ["workspaceId"],
        )
        const row = await this.entityManager.findOne(AuthorityEntity, { where: { workspaceId } })
        if (row === null) throw new AuthorityError({ code: AuthorityErrorCode.NotSaved })
        return profileOf(row)
    }
}
