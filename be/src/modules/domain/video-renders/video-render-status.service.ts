import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { RenderStatus, RenderStatusSelection } from "./video-renders.contracts"
import { VideoRendersService } from "./video-renders.service"

@Injectable()
/** The member-authorized progress read over workspace-scoped render persistence. */
export class VideoRenderStatusService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly renders: VideoRendersService,
    ) {}

    /** Proves active membership before reading a render inside the selected workspace. */
    async forMember(principalId: string, selection: RenderStatusSelection): Promise<RenderStatus> {
        await this.members.require(principalId, selection.workspaceId)
        return this.renders.getStatus(selection.workspaceId, selection.id)
    }
}
