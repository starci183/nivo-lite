import { Injectable } from "@nestjs/common"
import type {
    Installation,
    InstallationDirectory,
    InstallationRef,
    OptionalContextVersion,
    OptionalInstallation,
} from "@modules/domain/agents"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type {
    InstallationRecord,
    OptionalRowId,
    OptionalInstallationRecord,
} from "@modules/domain/module-installations"
import { ModulesService } from "./modules.service"

const TONE_GATE = "tone"

const installationOf = (record: OptionalInstallationRecord): OptionalInstallation =>
    record === null ? null : toInstallation(record)

const toInstallation = (record: InstallationRecord): Installation => ({
    id: record.id,
    workspaceId: record.workspaceId,
    module: record.moduleKey,
    name: record.name,
    isMulti: record.isMulti,
    agentId: record.agentId,
    operatingMode: record.operatingMode,
    settings: record.settings,
    activeContextVersionId: record.activeContextVersionId,
    liveEnabled: record.liveEnabled,
    removed: record.status === "removed",
})

@Injectable()
/** The installed agents as the agents capability reads them for the OpenClaw copy: the installation, its settings and its active version. */
export class InstallationDirectoryService implements InstallationDirectory {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly versions: ContextVersionsService,
        private readonly catalog: ModulesService,
    ) {}

    /** The installation of a workspace by id. */
    async byId(workspaceId: string, installationId: string): Promise<OptionalInstallation> {
        return installationOf(await this.installations.find(workspaceId, installationId))
    }

    /** The oldest installation of a module in a workspace. */
    async firstOfModule(workspaceId: string, module: string): Promise<OptionalInstallation> {
        return installationOf(await this.installations.firstOfModule(workspaceId, module))
    }

    /** The installation that owns an agent. */
    async ofAgent(workspaceId: string, agentId: string): Promise<OptionalInstallation> {
        return installationOf(await this.installations.ofAgent(workspaceId, agentId))
    }

    /** Up to `limit` installations that run on OpenClaw, of one workspace or of all when `workspaceId` is null. */
    onOpenclaw(workspaceId: OptionalRowId, limit: number): Promise<ReadonlyArray<InstallationRef>> {
        return this.installations.onOpenclaw(workspaceId, limit)
    }

    /** The context version with that id, flattened for the bundle: the confirmed gates in the order of the module, the facts, the tone. */
    async contextVersionOf(versionId: string): Promise<OptionalContextVersion> {
        const version = await this.versions.find(versionId)
        if (version === null) return null
        const installation = await this.installations.findById(version.installationId)
        const module = installation === null ? null : await this.catalog.find(installation.moduleKey)
        const { gates, facts, summary } = version.snapshot
        return {
            version: version.version,
            summary,
            gates: (module?.gates ?? [])
                .filter((gate) => gates[gate.key]?.status === "confirmed")
                .map((gate) => ({ label: gate.label_vi, evidence: gates[gate.key]?.evidence ?? "" })),
            facts: facts.map((fact) => fact.text),
            toneEvidence: gates[TONE_GATE]?.evidence ?? "",
        }
    }
}
