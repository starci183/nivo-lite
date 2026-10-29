import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyConfig, ProgramMatch, ProgramPatch } from "./loyalty-programs.contracts"
import { LoyaltyProgramEntity } from "./persistence/entities"
import { DEFAULT_CONFIG, resolveConfig } from "./policies/loyalty-config.policy"
import { programSlug } from "./policies/program-slug.policy"
import { toProgram } from "./policies/program.mapper"
import type { ProgramFields } from "./policies/program.mapper"

const SLUG_ATTEMPTS = 5

/** The columns a programme write answers, named as the entity names them. */
const PROGRAM_RETURNING = 'workspace_id AS "workspaceId", slug, name, enabled, config, created_at AS "createdAt"'

/** The slug, with a random suffix appended when a plain one raced. */
const SLUG_EXPRESSION =
    "CASE WHEN CAST(:suffix AS boolean) THEN CAST(:slug AS text) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) ELSE CAST(:slug AS text) END"

@Injectable()
/** The programme rules and public slug, read by the other loyalty capabilities and changed by authorised owners. */
export class LoyaltyProgramsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The programme of a workspace, or null when it never created one. */
    async find(workspaceId: string): Promise<ProgramMatch> {
        const row = await this.entityManager.findOne(LoyaltyProgramEntity, { where: { workspaceId } })
        return row === null ? null : toProgram(row)
    }

    /** The switched-on programme that owns a public slug, or null. */
    async findBySlug(slug: string): Promise<ProgramMatch> {
        const row = await this.entityManager.findOne(LoyaltyProgramEntity, { where: { slug, enabled: true } })
        return row === null ? null : toProgram(row)
    }

    /** The rules a workspace runs under: its programme, or the defaults before it created one. */
    async configOf(workspaceId: string): Promise<LoyaltyConfig> {
        const program = await this.find(workspaceId)
        return program === null ? DEFAULT_CONFIG : program.config
    }

    /** The programme when the module is installed and not paused and the owner switched the programme on, else null. */
    async findActive(workspaceId: string): Promise<ProgramMatch> {
        const installation = await this.entityManager
            .createQueryBuilder()
            .select("i.status", "status")
            .from("public.module_installations", "i")
            .where("i.workspace_id = :workspaceId AND i.module_key = 'loyalty'", { workspaceId })
            .limit(1)
            .getRawOne<{ status: string }>()
        if (installation === undefined || installation.status === "paused") return null
        const program = await this.find(workspaceId)
        return program?.enabled === true ? program : null
    }

    /** The name of the shop that runs the programme; empty when the workspace is gone. */
    async shopName(workspaceId: string): Promise<string> {
        const row = await this.entityManager
            .createQueryBuilder()
            .select("w.name", "name")
            .from("public.workspaces", "w")
            .where("w.id = :workspaceId", { workspaceId })
            .limit(1)
            .getRawOne<{ name: string }>()
        return row === undefined ? "" : row.name
    }

    /** Saves the supplied fields, creating the programme and public slug only on this write. */
    async save(workspaceId: string, patch: ProgramPatch): Promise<ProgramMatch> {
        const updated = await this.update(workspaceId, patch)
        if (updated !== null) return updated
        const shop = await this.shopName(workspaceId)
        const slug = programSlug(shop)
        return this.insertAttempt(workspaceId, patch, shop, slug, 0)
    }

    private async insertAttempt(
        workspaceId: string,
        patch: ProgramPatch,
        shop: string,
        slug: string,
        attempt: number,
    ): Promise<ProgramMatch> {
        const result = await this.entityManager
            .createQueryBuilder(LoyaltyProgramEntity, "lp")
            .insert()
            .values({
                workspaceId,
                slug: () => SLUG_EXPRESSION,
                name: () => "COALESCE(CAST(:name AS text), CAST(:shop AS text))",
                enabled: () => "COALESCE(CAST(:enabled AS boolean), true)",
                config: () => "CAST(:config AS jsonb)",
            })
            .setParameters({
                slug,
                shop,
                suffix: attempt > 0,
                name: patch.name?.trim().slice(0, 80) ?? null,
                enabled: patch.enabled ?? null,
                config: JSON.stringify(resolveConfig(patch.config ?? DEFAULT_CONFIG)),
            })
            .orIgnore()
            .returning(PROGRAM_RETURNING)
            .execute()
        const [row] = result.raw as Array<ProgramFields>
        if (row !== undefined) return toProgram(row)
        const raced = await this.update(workspaceId, patch)
        if (raced !== null) return raced
        return attempt + 1 >= SLUG_ATTEMPTS ? null : this.insertAttempt(workspaceId, patch, shop, slug, attempt + 1)
    }

    private async update(workspaceId: string, patch: ProgramPatch): Promise<ProgramMatch> {
        const result = await this.entityManager
            .createQueryBuilder(LoyaltyProgramEntity, "lp")
            .update()
            .set({
                name: () => "COALESCE(CAST(:name AS text), name)",
                enabled: () => "COALESCE(CAST(:enabled AS boolean), enabled)",
                config: () => "COALESCE(CAST(:config AS jsonb), config)",
                updatedAt: () => "now()",
            })
            .where("workspace_id = :workspaceId", { workspaceId })
            .setParameters({
                name: patch.name?.trim().slice(0, 80) ?? null,
                enabled: patch.enabled ?? null,
                config: patch.config === undefined ? null : JSON.stringify(resolveConfig(patch.config)),
            })
            .returning(PROGRAM_RETURNING)
            .execute()
        const [row] = result.raw as Array<ProgramFields>
        return row === undefined ? null : toProgram(row)
    }
}
