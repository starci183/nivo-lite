import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ContextVersionRecord,
    NewContextVersion,
    VersionNumber,
    OptionalContextVersionRecord,
} from "./module-context-versions.contracts"
import { ModuleContextVersionEntity } from "./persistence/entities"

/** How many versions of one installation are listed at once. */
const VERSIONS_LIMIT = 100

/** The most version numbers one lookup answers. */
const NUMBERS_MAX = 500

/** Maps a stored version to its contract. */
const toRecord = (row: ModuleContextVersionEntity): ContextVersionRecord => ({
    id: row.id,
    installationId: row.installationId,
    version: row.version,
    snapshot: row.snapshot,
    appliedBy: row.appliedBy,
    appliedAt: row.appliedAt.toISOString(),
})

@Injectable()
/** The applied context versions of the installations: the only owner of the module_context_versions table. */
export class ContextVersionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The applied versions of an installation, newest first. */
    async list(installationId: string): Promise<ReadonlyArray<ContextVersionRecord>> {
        const rows = await this.entityManager.find(ModuleContextVersionEntity, {
            where: { installationId },
            order: { version: "DESC" },
            take: VERSIONS_LIMIT,
        })
        return rows.map(toRecord)
    }

    /** One version by id; null when there is none. */
    async find(versionId: string): Promise<OptionalContextVersionRecord> {
        const row = await this.entityManager.findOne(ModuleContextVersionEntity, { where: { id: versionId } })
        return row === null ? null : toRecord(row)
    }

    /** The version numbers of the given versions, by id (an id that does not exist is absent from the answer). */
    async numbersOf(versionIds: ReadonlyArray<string>): Promise<ReadonlyArray<VersionNumber>> {
        if (versionIds.length === 0) return []
        const wanted = [...new Set(versionIds)].slice(0, NUMBERS_MAX)
        const rows = await this.entityManager.find(ModuleContextVersionEntity, {
            select: { id: true, version: true },
            where: { id: In(wanted) },
            take: NUMBERS_MAX,
        })
        return rows.map((row) => ({ id: row.id, version: row.version }))
    }

    /** The newest version of an installation; null before the first apply. */
    async latest(installationId: string): Promise<OptionalContextVersionRecord> {
        const row = await this.entityManager.findOne(ModuleContextVersionEntity, {
            where: { installationId },
            order: { version: "DESC" },
        })
        return row === null ? null : toRecord(row)
    }

    /** Stores a new version; a version is immutable, so there is no update. */
    async insert(version: NewContextVersion): Promise<ContextVersionRecord> {
        const row = await this.entityManager.save(ModuleContextVersionEntity, {
            workspaceId: version.workspaceId,
            installationId: version.installationId,
            version: version.version,
            snapshot: version.snapshot,
            appliedBy: version.appliedBy,
        })
        return toRecord(row)
    }
}
