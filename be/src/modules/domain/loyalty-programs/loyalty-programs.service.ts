import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyProgram } from "./loyalty-programs.contracts"
import {
    SELECT_MODULE_STATUS,
    SELECT_PROGRAM,
    SELECT_PROGRAM_BY_SLUG,
    SELECT_SHOP_NAME,
} from "./persistence/loyalty-programs.sql"
import { toProgram } from "./persistence/loyalty-programs.rows"
import type { ProgramRow } from "./persistence/loyalty-programs.rows"

@Injectable()
/** Reads the loyalty programme of a workspace; the owner writes it under row level security from the front end. */
export class LoyaltyProgramsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The programme of a workspace, or null when it never created one. */
    async find(workspaceId: string): Promise<LoyaltyProgram | null> {
        const [row] = await this.entityManager.query<Array<ProgramRow>>(SELECT_PROGRAM, [workspaceId])
        return row === undefined ? null : toProgram(row)
    }

    /** The switched-on programme that owns a public slug, or null. */
    async findBySlug(slug: string): Promise<LoyaltyProgram | null> {
        const [row] = await this.entityManager.query<Array<ProgramRow>>(SELECT_PROGRAM_BY_SLUG, [slug])
        return row === undefined ? null : toProgram(row)
    }

    /** The programme when the module is installed and not paused and the owner switched the programme on, else null. */
    async findActive(workspaceId: string): Promise<LoyaltyProgram | null> {
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
}
