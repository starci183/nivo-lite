import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BrandProposalClosing,
    BrandProposalRecord,
    NewBrandProposal,
    OptionalBrandProposalRecord,
} from "./content-brand-proposals.contracts"
import { ContentBrandProposalEntity } from "./persistence/entities"

/** A stored proposal as the columns answer it: `createdAt` is the text `to_json(created_at) #>> '{}'` gives, not a Date. */
type StoredProposal = Omit<ContentBrandProposalEntity, "createdAt" | "decidedAt"> & { readonly createdAt: string }

const recordOf = (row: StoredProposal): BrandProposalRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    installationId: row.installationId,
    setupSessionId: row.setupSessionId,
    fileName: row.fileName,
    fileSize: row.fileSize,
    payload: row.payload,
    status: row.status,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt,
})

/** The columns a write answers, named as the entity properties so the answer reads as an entity. */
const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    'installation_id AS "installationId"',
    'setup_session_id AS "setupSessionId"',
    'file_name AS "fileName"',
    'file_size AS "fileSize"',
    "payload",
    "status",
    'decided_by AS "decidedBy"',
    "to_json(created_at) #>> '{}' AS \"createdAt\"",
].join(", ")

/** True when a row names the key of a stored proposal and its text timestamp, the shape the selected columns give it. */
const isStoredProposal = (value: unknown): value is StoredProposal =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"

/** The rows a statement answered. */
const storedProposals = (raw: unknown): Array<StoredProposal> =>
    Array.isArray(raw) ? raw.filter(isStoredProposal) : []

@Injectable()
/** The `content_brand_proposals` rows: brand kits read from attached guidelines, waiting for or past the owner's decision. */
export class ContentBrandProposalsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Stores a waiting proposal; null when nothing was stored. */
    async insert(proposal: NewBrandProposal): Promise<OptionalBrandProposalRecord> {
        const stored = await this.entityManager
            .createQueryBuilder(ContentBrandProposalEntity, "cbp")
            .insert()
            .values({
                workspaceId: proposal.workspaceId,
                installationId: proposal.installationId,
                setupSessionId: proposal.setupSessionId,
                fileName: proposal.fileName.slice(0, 255),
                fileSize: proposal.fileSize,
                payload: () => ":payload::jsonb",
            })
            .setParameter("payload", proposal.payload)
            .returning(RETURNED)
            .execute()
        const [row] = storedProposals(stored.raw)
        return row === undefined ? null : recordOf(row)
    }

    /** One proposal of the workspace, or null. */
    async find(workspaceId: string, id: string): Promise<OptionalBrandProposalRecord> {
        const rows = await this.entityManager
            .createQueryBuilder(ContentBrandProposalEntity, "p")
            .select(RETURNED)
            .where({ workspaceId, id })
            .limit(1)
            .getRawMany()
        const [row] = storedProposals(rows)
        return row === undefined ? null : recordOf(row)
    }

    /** The ten newest proposals of an installation. */
    async list(workspaceId: string, installationId: string): Promise<ReadonlyArray<BrandProposalRecord>> {
        const rows = await this.entityManager
            .createQueryBuilder(ContentBrandProposalEntity, "p")
            .select(RETURNED)
            .where({ workspaceId, installationId })
            .orderBy("p.createdAt", "DESC")
            .limit(10)
            .getRawMany()
        return storedProposals(rows).map(recordOf)
    }

    /** Closes a waiting proposal; null when it was decided already. */
    async close(workspaceId: string, id: string, closing: BrandProposalClosing): Promise<OptionalBrandProposalRecord> {
        const closed = await this.entityManager
            .createQueryBuilder(ContentBrandProposalEntity, "cbp")
            .update()
            .set({
                status: closing.status,
                payload: () => ":payload::jsonb",
                decidedBy: closing.decidedBy,
                decidedAt: () => "now()",
            })
            .setParameter("payload", closing.payload)
            .where({ workspaceId, id, status: "proposed" })
            .returning(RETURNED)
            .execute()
        const [row] = storedProposals(closed.raw)
        return row === undefined ? null : recordOf(row)
    }
}
