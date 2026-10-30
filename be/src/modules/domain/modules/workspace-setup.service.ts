import { Injectable } from "@nestjs/common"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { CreatedWorkspace, NamedBusinessType } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { ModulesService } from "./modules.service"
import { defaultRulesOf } from "./policies/instance.policy"

@Injectable()
/**
 * The setup of a new workspace: the workspace itself, then the governance it starts with, its authority sheet and the default
 * authority rules of every stable module of the catalogue (an early module grants its own rules when it is installed). The web app used
 * to lay the governance down on the first session of a workspace; the back end now does it when the workspace is set up. The rules are
 * granted only together with the sheet, so a rule the owner removed later never comes back, and a rule already set is never overwritten.
 */
export class WorkspaceSetupService {
    constructor(
        private readonly workspaces: WorkspacesService,
        private readonly authority: AuthorityService,
        private readonly rules: AuthorityRulesService,
        private readonly catalog: ModulesService,
    ) {}

    /** Creates a free workspace owned by the person, with the business type they named, and lays down its governance. */
    async createFree(
        userId: string,
        name: string,
        businessType: NamedBusinessType = null,
    ): Promise<CreatedWorkspace> {
        const created = await this.workspaces.createFree(userId, name, businessType)
        await this.ensureGovernance(created.id)
        return created
    }

    /** Lays down the authority sheet and the default rules of a workspace that has no sheet yet; answers true when it did. */
    async ensureGovernance(workspaceId: string): Promise<boolean> {
        if (!(await this.authority.ensureSheet(workspaceId))) return false
        const { modules } = await this.catalog.catalog()
        await eachInOrder(
            modules.filter((module) => module.status === "stable"),
            (module) => this.rules.seedDefaults(workspaceId, module.key, defaultRulesOf(module)),
        )
        return true
    }
}
