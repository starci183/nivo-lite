import { Injectable } from "@nestjs/common"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { CatalogModule, ModuleDefinition, OpenCatalog } from "./modules.contracts"
import { ModulesService } from "./modules.service"

/** A workspace id, or null when the caller names none. */
type OptionalWorkspace = string | null

@Injectable()
/**
 * Who may see and install which module ("kho agents"). The catalogue is ONE list fed by the installation: the modules of every
 * plugin, the core package's and each plugin package's alike. A module of a public plugin is open to every workspace. A module of a
 * private plugin is open only to the enterprise workspaces the plugin names (the workspace's enterprise identifier is one of the
 * plugin's `enterprises`); to every other workspace, and to a caller who names no workspace, it does not exist: it is not listed and
 * reading or installing it answers the same not-found an unknown key answers, so nothing tells a private module from no module.
 */
export class ModuleAccessService {
    constructor(
        private readonly catalog: ModulesService,
        private readonly enterprise: WorkspaceEnterpriseService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The catalogue as a workspace is shown it (the caller must be a member); with no workspace, the modules of public plugins only. */
    async catalogFor(principalId: string, workspaceId: OptionalWorkspace): Promise<OpenCatalog> {
        if (workspaceId !== null) await this.members.require(principalId, workspaceId)
        const catalog = await this.catalog.catalog()
        const open = await this.enterprise.openOf(workspaceId, catalog.modules)
        return { categories: catalog.categories, modules: open.map((module) => this.withPlugin(module)) }
    }

    /** One module as a workspace may read it (the caller must be a member); a module closed to it is not found. */
    async findFor(principalId: string, key: string, workspaceId: OptionalWorkspace): Promise<CatalogModule> {
        const module = this.withPlugin(await this.catalog.find(key))
        if (INSTALLED.isOpenTo(key, null)) return module
        if (workspaceId === null) throw this.closed(key)
        await this.members.require(principalId, workspaceId)
        await this.requireOpen(workspaceId, key)
        return module
    }

    /** The module with the plugin it belongs to: its key and its label, which the catalogue puts in front of the agent's name. */
    private withPlugin(module: ModuleDefinition): CatalogModule {
        const plugin = INSTALLED.pluginOfModule(module.key)
        return { ...module, plugin: { key: plugin?.key ?? "", label: plugin?.label ?? { vi: "", en: "" } } }
    }

    /** Refuses a module the workspace may not see: the not-found of an unknown key. */
    async requireOpen(workspaceId: string, key: string): Promise<void> {
        if (!(await this.enterprise.opens(workspaceId, key))) throw this.closed(key)
    }

    private closed(key: string): ModulesError {
        return new ModulesError({ code: ModulesErrorCode.NotFound, params: { key } })
    }
}
