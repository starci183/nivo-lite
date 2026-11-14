import { Injectable } from "@nestjs/common"
import {
    WorkspacesService,
    type CreatedWorkspace,
    type FirstWorkspace,
    type NamedBusinessType,
} from "@modules/domain/workspaces"

@Injectable()
/**
 * The setup of a new workspace: the workspace itself. No authority sheet and no default authority rules are laid down: the rules decide
 * nothing since the engine gate was removed by the owner's rule (2026-11-13; a node's declared mode alone decides).
 */
export class WorkspaceSetupService {
    constructor(private readonly workspaces: WorkspacesService) {}

    /** Creates a free workspace owned by the person, with the business type they named. */
    createFree(userId: string, name: string, businessType: NamedBusinessType = null): Promise<CreatedWorkspace> {
        return this.workspaces.createFree(userId, name, businessType)
    }

    /** The first workspace of a person with none; its id is null when none was made. */
    startFirst(userId: string): Promise<FirstWorkspace> {
        return this.workspaces.startFirst(userId)
    }
}
