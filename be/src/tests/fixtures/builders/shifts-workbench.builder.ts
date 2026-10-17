import { builder } from "@starci/jest-preset"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** A staff profile shared by the workbench setup. */
export const SHIFT_STAFF = {
    id: "profile-1",
    name: "Alex",
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
}

export const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: "staff-row-1",
    displayName: "Lan",
    status: "active",
})
