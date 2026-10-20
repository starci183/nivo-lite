import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BrandProposalClosing,
    BrandProposalRecord,
    NewBrandProposal,
    OptionalBrandProposalRecord,
} from "./content-brand-proposals.contracts"
import type { BrandProposalRow } from "./persistence/content-brand-proposals.rows"
import {
    CLOSE_BRAND_PROPOSAL,
    FIND_BRAND_PROPOSAL,
    INSERT_BRAND_PROPOSAL,
    LIST_BRAND_PROPOSALS,
} from "./persistence/content-brand-proposals.sql"

const recordOf = (row: BrandProposalRow): BrandProposalRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    installationId: row.installation_id,
    setupSessionId: row.setup_session_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    payload: row.payload,
    status: row.status,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
})

@Injectable()
/** The `content_brand_proposals` rows: brand kits read from attached guidelines, waiting for or past the owner's decision. */
export class ContentBrandProposalsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Stores a waiting proposal; null when nothing was stored. */
    async insert(proposal: NewBrandProposal): Promise<OptionalBrandProposalRecord> {
        const [row] = await this.entityManager.query<Array<BrandProposalRow>>(INSERT_BRAND_PROPOSAL, [
            proposal.workspaceId,
            proposal.installationId,
            proposal.setupSessionId,
            proposal.fileName.slice(0, 255),
            proposal.fileSize,
            proposal.payload,
        ])
        return row === undefined ? null : recordOf(row)
    }

    /** One proposal of the workspace, or null. */
    async find(workspaceId: string, id: string): Promise<OptionalBrandProposalRecord> {
        const [row] = await this.entityManager.query<Array<BrandProposalRow>>(FIND_BRAND_PROPOSAL, [workspaceId, id])
        return row === undefined ? null : recordOf(row)
    }

    /** The ten newest proposals of an installation. */
    async list(workspaceId: string, installationId: string): Promise<ReadonlyArray<BrandProposalRecord>> {
        const rows = await this.entityManager.query<Array<BrandProposalRow>>(LIST_BRAND_PROPOSALS, [
            workspaceId,
            installationId,
        ])
        return rows.map(recordOf)
    }

    /** Closes a waiting proposal; null when it was decided already. */
    async close(workspaceId: string, id: string, closing: BrandProposalClosing): Promise<OptionalBrandProposalRecord> {
        const [row] = await this.entityManager.query<Array<BrandProposalRow>>(CLOSE_BRAND_PROPOSAL, [
            workspaceId,
            id,
            closing.status,
            closing.payload,
            closing.decidedBy,
        ])
        return row === undefined ? null : recordOf(row)
    }
}
