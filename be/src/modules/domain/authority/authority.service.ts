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

const profileOf = (entity: SavedSheet): AuthorityProfile => ({
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

/** The columns a save overwrites when the sheet exists. */
const UPSERT_COLUMNS = [
    "policies",
    "reply_style",
    "brand_voice",
    "limits_note",
    "goal_revenue_vnd",
    "goal_new_customers",
    "goal_first_reply_minutes",
    "goal_note",
    "updated_by",
    "updated_at",
]

/** The columns a save reads back from the statement itself, aliased to the property names of the entity. */
const RETURNED_COLUMNS =
    'policies, reply_style AS "replyStyle", brand_voice AS "brandVoice", limits_note AS "limitsNote", goal_revenue_vnd AS "goalRevenueVnd", goal_new_customers AS "goalNewCustomers", goal_first_reply_minutes AS "goalFirstReplyMinutes", goal_note AS "goalNote", updated_by AS "updatedBy", updated_at AS "updatedAt"'

/** The sheet fields a profile is read from: the entity, or the row the saving statement hands back (bigint as text, instants as Dates). */
type SavedSheet = Pick<
    AuthorityEntity,
    | "policies"
    | "replyStyle"
    | "brandVoice"
    | "limitsNote"
    | "goalRevenueVnd"
    | "goalNewCustomers"
    | "goalFirstReplyMinutes"
    | "goalNote"
    | "updatedBy"
    | "updatedAt"
>

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
        const saved = await this.entityManager
            .createQueryBuilder(AuthorityEntity, "au")
            .insert()
            .values({
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
            })
            .orUpdate(UPSERT_COLUMNS, ["workspace_id"])
            .returning(RETURNED_COLUMNS)
            .execute()
        const [row] = Array.isArray(saved.raw) ? (saved.raw as Array<SavedSheet>) : []
        if (row === undefined) throw new AuthorityError({ code: AuthorityErrorCode.NotSaved })
        return profileOf(row)
    }
}
