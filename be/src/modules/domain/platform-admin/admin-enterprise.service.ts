import { Injectable } from "@nestjs/common"
import { WorkspaceEnterpriseService, type EnterpriseKey } from "@modules/domain/workspaces"
import type { Principal } from "@modules/platform/cqrs"
import { AdminAccessService } from "./admin-access.service"
import type { EnterpriseKeySet } from "./platform-admin.contracts"

@Injectable()
/**
 * The platform admin's door onto a workspace's enterprise identifier: the only door of the app that sets, changes or clears it (the
 * seed is the other writer). The identifier opens the private plugins that name it to that workspace; clearing or changing it closes
 * them, and an installed agent of such a plugin then stops at its next step and reports through the engine's common path.
 */
export class AdminEnterpriseService {
    constructor(
        private readonly access: AdminAccessService,
        private readonly enterprise: WorkspaceEnterpriseService,
    ) {}

    /** Sets the enterprise identifier of a workspace, or clears it with null; a caller who is no platform admin changes nothing. */
    async setEnterpriseKey(principal: Principal, workspaceId: string, key: EnterpriseKey): Promise<EnterpriseKeySet> {
        const admin = this.access.requireAdmin(principal)
        const change = await this.enterprise.set(workspaceId, key)
        await this.access.audit(admin, "workspace.set_enterprise_key", workspaceId, { ...change })
        return { enterpriseKey: change.to }
    }
}
