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
import type { AuthorityProfileRow, AuthorityRow, CreatedAuthorityRow } from "./persistence/authority.rows"
import {
    CREATE_AUTHORITY_IF_MISSING,
    FIND_AUTHORITY,
    FIND_AUTHORITY_PROFILE,
    UPSERT_AUTHORITY,
} from "./persistence/authority.sql"

@Injectable()
/** The owner's goals and house rules: the only owner of the authority table. */
export class AuthorityService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The house rules the prompts carry; null before the owner set any. */
    async load(scope: AuthorityScope): Promise<OptionalAuthority> {
        const row = (await this.entityManager.query<Array<AuthorityRow>>(FIND_AUTHORITY, [scope.workspaceId]))[0]
        return row ?? null
    }

    /** The whole sheet the Authority page edits; null before the owner set any. */
    async profileOf(workspaceId: string): Promise<OptionalAuthorityProfile> {
        const row = (
            await this.entityManager.query<Array<AuthorityProfileRow>>(FIND_AUTHORITY_PROFILE, [workspaceId])
        )[0]
        return row ?? null
    }

    /** Creates the empty sheet of a workspace that has none; true only when this call created it (a concurrent call answers false). */
    async ensureSheet(workspaceId: string): Promise<boolean> {
        const created = await this.entityManager.query<Array<CreatedAuthorityRow>>(CREATE_AUTHORITY_IF_MISSING, [
            workspaceId,
        ])
        return created.length > 0
    }

    /** Lays the patch over the stored sheet and saves the result, stamped with who saved it. */
    async save(workspaceId: string, patch: AuthorityPatch, updatedBy: string): Promise<AuthorityProfile> {
        const next = mergeAuthority(await this.profileOf(workspaceId), patch)
        const saved = (
            await this.entityManager.query<Array<AuthorityProfileRow>>(UPSERT_AUTHORITY, [
                workspaceId,
                next.policies,
                next.reply_style,
                next.brand_voice,
                next.limits_note,
                next.goal_revenue_vnd,
                next.goal_new_customers,
                next.goal_first_reply_minutes,
                next.goal_note,
                updatedBy,
            ])
        )[0]
        if (saved === undefined) throw new AuthorityError({ code: AuthorityErrorCode.NotSaved })
        return saved
    }
}
