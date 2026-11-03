import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTemplateVersionsService, insertedId } from "@modules/domain/agent-templates"
import { AdminAccessService } from "@modules/domain/platform-admin"
import type { Principal } from "@modules/platform/cqrs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import type { LikenessGrantView } from "./template-marketplace.contracts"
import { TemplateLikenessGrantEntity } from "./persistence/entities"
import { consentCovers } from "./policies/likeness.policy"
import type { LikenessClaim } from "@modules/domain/agent-templates"

/** What the creator records. */
export interface LikenessGrantRequest {
    /** The template. */
    readonly templateKey: string
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<"name" | "avatar" | "voice_style" | "first_person">
    /** The line shown to every customer. */
    readonly disclosure: string
    /** When the consent ends, or null. */
    readonly expiresAt: Date | null
}

/** The most records one template lists. */
const LIST_MAX = 50

const viewOf = (row: TemplateLikenessGrantEntity): LikenessGrantView => ({
    id: row.id,
    templateKey: row.templateKey,
    personName: row.personName,
    allowedUses: row.allowedUses,
    disclosure: row.disclosure,
    verified: row.verifiedBy !== null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revoked: row.revokedAt !== null,
})

@Injectable()
/**
 * The consent of a real person to a persona. The creator of the template records it, a reviewer of the platform checks the identity of
 * the person at review, and the person can take it back at any time; a listing whose persona names a real person is not submitted or
 * approved without a record of that same person that is verified, not ended and not taken back, covering every use the persona claims.
 */
export class TemplateLikenessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly versions: AgentTemplateVersionsService,
        private readonly access: AdminAccessService,
    ) {}

    /** Records the consent of a person to the persona of a template of the caller. */
    async record(userId: string, request: LikenessGrantRequest): Promise<LikenessGrantView> {
        await this.requireOwned(userId, request.templateKey)
        const inserted = await this.entityManager.insert(TemplateLikenessGrantEntity, {
            templateKey: request.templateKey,
            personName: request.personName.trim(),
            allowedUses: [...request.allowedUses],
            disclosure: request.disclosure.trim(),
            grantedBy: userId,
            expiresAt: request.expiresAt,
        })
        return this.viewOf(insertedId(inserted.identifiers))
    }

    /** The records of a template of the caller, newest first. */
    async list(userId: string, templateKey: string): Promise<ReadonlyArray<LikenessGrantView>> {
        await this.requireOwned(userId, templateKey)
        const rows = await this.entityManager.find(TemplateLikenessGrantEntity, {
            where: { templateKey },
            order: { createdAt: "DESC" },
            take: LIST_MAX,
        })
        return rows.map((row) => viewOf(row))
    }

    /** Takes the consent back: from then on no listing rests on it. The creator does it for the person. */
    async revoke(userId: string, grantId: string): Promise<LikenessGrantView> {
        const row = await this.entityManager.findOne(TemplateLikenessGrantEntity, { where: { id: grantId } })
        if (row === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.GrantNotFound })
        await this.requireOwned(userId, row.templateKey)
        await this.entityManager.update(TemplateLikenessGrantEntity, { id: grantId }, { revokedAt: this.clock.now() })
        return this.viewOf(grantId)
    }

    /** A platform reviewer confirms the person is who the record says. */
    async verify(principal: Principal, grantId: string): Promise<LikenessGrantView> {
        const admin = this.access.requireAdmin(principal)
        const row = await this.entityManager.findOne(TemplateLikenessGrantEntity, { where: { id: grantId } })
        if (row === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.GrantNotFound })
        await this.entityManager.update(
            TemplateLikenessGrantEntity,
            { id: grantId },
            { verifiedBy: admin.userId, verifiedAt: this.clock.now() },
        )
        return this.viewOf(grantId)
    }

    /** True when the persona is covered by a verified consent that is still valid. */
    async covers(templateKey: string, claim: LikenessClaim | null): Promise<boolean> {
        if (claim === null) return true
        const rows = await this.entityManager.find(TemplateLikenessGrantEntity, {
            where: { templateKey },
            take: LIST_MAX,
        })
        return consentCovers(
            claim,
            rows.filter((row) => row.verifiedBy !== null),
            this.clock.now(),
        )
    }

    private async viewOf(grantId: string): Promise<LikenessGrantView> {
        return viewOf(await this.entityManager.findOneOrFail(TemplateLikenessGrantEntity, { where: { id: grantId } }))
    }

    private async requireOwned(userId: string, templateKey: string): Promise<void> {
        const template = await this.versions.templateOf(templateKey)
        if (template?.creatorAccountId !== userId) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotYours })
        }
    }
}
