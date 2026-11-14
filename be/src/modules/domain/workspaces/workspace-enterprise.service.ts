import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { isEnterpriseKey } from "./workspace-enterprise.policy"
import type { EnterpriseKey, EnterpriseKeyChange, KeyedModule } from "./workspaces.contracts"

@Injectable()
/**
 * The enterprise identifier of a workspace: an ordinary workspace is known by its uuid alone; an enterprise workspace also carries ONE
 * string identifier (`nivo-web`), unique across the platform. It is an additional name, never a key of anything: routes, foreign keys,
 * row security and tokens keep the uuid. Only the seed and the platform admin set, change or clear it (no door of the workspace's own
 * owner writes it). It decides one thing: which PRIVATE plugins the workspace may see, install and run, a private plugin naming the
 * identifiers it belongs to. A module of a public plugin is open to every workspace and costs no read here.
 */
export class WorkspaceEnterpriseService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The enterprise identifier of a workspace; null for an ordinary workspace or one that does not exist. */
    async keyOf(workspaceId: string): Promise<EnterpriseKey> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { enterpriseKey: true },
            where: { id: workspaceId },
        })
        return row?.enterpriseKey ?? null
    }

    /**
     * Sets, changes or (with null) clears the enterprise identifier of a workspace, and answers what it was and is. A malformed
     * identifier and one another workspace holds are refused; an unknown workspace is not found. The caller proves who may: the
     * platform admin door and the seed are the only callers.
     */
    set(workspaceId: string, key: EnterpriseKey): Promise<EnterpriseKeyChange> {
        if (key !== null && !isEnterpriseKey(key)) {
            return Promise.reject(new WorkspacesError({ code: WorkspacesErrorCode.EnterpriseKeyInvalid }))
        }
        return this.entityManager.transaction(async (tx) => {
            const held = await tx.findOne(WorkspaceEntity, {
                select: { id: true, enterpriseKey: true },
                where: { id: workspaceId },
            })
            if (held === null) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
            const from = held.enterpriseKey ?? null
            if (from === key) return { from, to: key }
            if (key !== null) {
                const other = await tx.findOne(WorkspaceEntity, { select: { id: true }, where: { enterpriseKey: key } })
                if (other !== null) throw new WorkspacesError({ code: WorkspacesErrorCode.EnterpriseKeyTaken })
            }
            await tx.update(WorkspaceEntity, { id: workspaceId }, { enterpriseKey: key })
            return { from, to: key }
        })
    }

    /**
     * Whether a workspace may see, install and run a module: always for a module of a public plugin (no read); for a module of a
     * private plugin only when the workspace's enterprise identifier is one the plugin names. An ordinary workspace never matches.
     */
    async opens(workspaceId: string, moduleKey: string): Promise<boolean> {
        if (INSTALLED.isOpenTo(moduleKey, null)) return true
        return INSTALLED.isOpenTo(moduleKey, await this.keyOf(workspaceId))
    }

    /**
     * The modules of a list a workspace may see, in the list's order; with no workspace, the modules of public plugins only. The
     * identifier is read once, and only when the list holds a module of a private plugin.
     */
    async openOf<M extends KeyedModule>(workspaceId: EnterpriseKey, modules: ReadonlyArray<M>): Promise<ReadonlyArray<M>> {
        if (modules.every((module) => INSTALLED.isOpenTo(module.key, null))) return modules
        const key = workspaceId === null ? null : await this.keyOf(workspaceId)
        return modules.filter((module) => INSTALLED.isOpenTo(module.key, key))
    }
}
