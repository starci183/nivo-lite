import { Injectable } from "@nestjs/common"
import type { RecordInstallation } from "@modules/domain/module-installations"
import { InjectRecordInstallationSources } from "./modules.decorators"
import type { RecordInstallationSource } from "./modules.port"

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
/** Finds the installation that owns a record of the workspace by asking each capability that keeps records naming an installation. */
export class RecordInstallationService {
    constructor(@InjectRecordInstallationSources() private readonly sources: ReadonlyArray<RecordInstallationSource>) {}

    /**
     * The installation that owns a work item, conversation, booking, lead flow or lead of the workspace, the first of those
     * that names one. Null when the id is none of those rows, or the row names no installation.
     */
    async installationOfRecord(workspaceId: string, recordId: string): Promise<RecordInstallation> {
        if (!RECORD_ID.test(recordId)) return { installationId: null }
        const found = await Promise.all(this.sources.map((source) => source.installationIdOf(workspaceId, recordId)))
        return { installationId: found.find((installationId) => installationId !== null) ?? null }
    }
}
