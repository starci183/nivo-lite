import type { DynamicModule } from "@nestjs/common"
import { EventsModule } from "@modules/domain/events"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { TeamChatProofModule } from "./team-chat-proof.module"

/** The team chat over the capabilities it reads through: the ids and the clock, the events the seats announce on, the seats of the workspace, the workspace owner. */
export const TEAM_CHAT_PROOF_MODULES: ReadonlyArray<DynamicModule> = [
    IdsModule.register({ isGlobal: true }),
    ClockModule.register({ isGlobal: true }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: false }),
    TeamChatProofModule.register(),
]
