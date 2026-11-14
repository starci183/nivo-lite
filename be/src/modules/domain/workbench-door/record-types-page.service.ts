import { Injectable } from "@nestjs/common"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ModuleInstallService } from "@modules/domain/modules"
import type { RecordModuleView } from "./record-types.contracts"
import { recordModulesOf } from "./record-types.policy"

@Injectable()
/**
 * The record types a member reaches: those of the agents the workspace installed (any member may read the list; each read and action
 * then needs its own declared permission at the workbench door), from the installed declarations, never from the data.
 */
export class RecordTypesPageService {
    constructor(private readonly installs: ModuleInstallService) {}

    /** The workspace's installed modules with their record types, reads and actions. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<RecordModuleView>> {
        const installations = await this.installs.list(principalId, workspaceId)
        return recordModulesOf(
            installations.map((installation) => installation.moduleKey),
            INSTALLED.moduleOf,
            INSTALLED.entities(),
        )
    }
}
