import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyConfig, ProgramMatch, ProgramPatch } from "./loyalty-programs.contracts"
import {
    SELECT_MODULE_STATUS,
    SELECT_PROGRAM,
    SELECT_PROGRAM_BY_SLUG,
    SELECT_SHOP_NAME,
    INSERT_PROGRAM,
    UPDATE_PROGRAM,
} from "./persistence/loyalty-programs.sql"
import { DEFAULT_CONFIG, resolveConfig } from "./policies/loyalty-config.policy"
import { programSlug } from "./policies/program-slug.policy"
import { toProgram } from "./persistence/loyalty-programs.rows"
import type { ProgramRow } from "./persistence/loyalty-programs.rows"

const SLUG_ATTEMPTS = 5

@Injectable()
/** The programme rules and public slug, read by the other loyalty capabilities and changed by authorised owners. */
export class LoyaltyProgramsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The programme of a workspace, or null when it never created one. */
    async find(workspaceId: string): Promise<ProgramMatch> {
        const [row] = await this.entityManager.query<Array<ProgramRow>>(SELECT_PROGRAM, [workspaceId])
        return row === undefined ? null : toProgram(row)
    }

    /** The switched-on programme that owns a public slug, or null. */
    async findBySlug(slug: string): Promise<ProgramMatch> {
        const [row] = await this.entityManager.query<Array<ProgramRow>>(SELECT_PROGRAM_BY_SLUG, [slug])
        return row === undefined ? null : toProgram(row)
    }

    /** The rules a workspace runs under: its programme, or the defaults before it created one. */
    async configOf(workspaceId: string): Promise<LoyaltyConfig> {
        const program = await this.find(workspaceId)
        return program === null ? DEFAULT_CONFIG : program.config
    }

    /** The programme when the module is installed and not paused and the owner switched the programme on, else null. */
    async findActive(workspaceId: string): Promise<ProgramMatch> {
        const [installation] = await this.entityManager.query<Array<{ status: string }>>(SELECT_MODULE_STATUS, [
            workspaceId,
        ])
        if (installation === undefined || installation.status === "paused") return null
        const program = await this.find(workspaceId)
        return program?.enabled === true ? program : null
    }

    /** The name of the shop that runs the programme; empty when the workspace is gone. */
    async shopName(workspaceId: string): Promise<string> {
        const [row] = await this.entityManager.query<Array<{ name: string }>>(SELECT_SHOP_NAME, [workspaceId])
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
        const [row] = await this.entityManager.query<Array<ProgramRow>>(INSERT_PROGRAM, [
            workspaceId,
            slug,
            shop,
            patch.name?.trim().slice(0, 80) ?? null,
            patch.enabled ?? null,
            JSON.stringify(resolveConfig(patch.config ?? DEFAULT_CONFIG)),
            attempt > 0,
        ])
        if (row !== undefined) return toProgram(row)
        const raced = await this.update(workspaceId, patch)
        if (raced !== null) return raced
        return attempt + 1 >= SLUG_ATTEMPTS ? null : this.insertAttempt(workspaceId, patch, shop, slug, attempt + 1)
    }

    private async update(workspaceId: string, patch: ProgramPatch): Promise<ProgramMatch> {
        const [row] = await this.entityManager.query<Array<ProgramRow>>(UPDATE_PROGRAM, [
            workspaceId,
            patch.name?.trim().slice(0, 80) ?? null,
            patch.enabled ?? null,
            patch.config === undefined ? null : JSON.stringify(resolveConfig(patch.config)),
        ])
        return row === undefined ? null : toProgram(row)
    }
}
