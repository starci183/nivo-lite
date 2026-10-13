import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ContextVersionRecord,
    NewContextVersion,
    OptionalContextVersionRecord,
} from "./module-context-versions.contracts"
import {
    FIND_CONTEXT_VERSION,
    FIND_LATEST_CONTEXT_VERSION,
    INSERT_CONTEXT_VERSION,
    LIST_CONTEXT_VERSIONS,
} from "./persistence/module-context-versions.sql"

@Injectable()
/** The applied context versions of the installations: the only owner of the module_context_versions table. */
export class ContextVersionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The applied versions of an installation, newest first. */
    list(installationId: string): Promise<ReadonlyArray<ContextVersionRecord>> {
        return this.entityManager.query<Array<ContextVersionRecord>>(LIST_CONTEXT_VERSIONS, [installationId])
    }

    /** One version by id; null when there is none. */
    async find(versionId: string): Promise<OptionalContextVersionRecord> {
        const [row] = await this.entityManager.query<Array<ContextVersionRecord>>(FIND_CONTEXT_VERSION, [versionId])
        return row ?? null
    }

    /** The newest version of an installation; null before the first apply. */
    async latest(installationId: string): Promise<OptionalContextVersionRecord> {
        const [row] = await this.entityManager.query<Array<ContextVersionRecord>>(FIND_LATEST_CONTEXT_VERSION, [
            installationId,
        ])
        return row ?? null
    }

    /** Stores a new version; a version is immutable, so there is no update. */
    async insert(version: NewContextVersion): Promise<ContextVersionRecord> {
        const [row] = await this.entityManager.query<[ContextVersionRecord]>(INSERT_CONTEXT_VERSION, [
            version.workspaceId,
            version.installationId,
            version.version,
            JSON.stringify(version.snapshot),
            version.appliedBy,
        ])
        return row
    }
}
