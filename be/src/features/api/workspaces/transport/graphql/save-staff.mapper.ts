import type { StaffOption } from "@modules/domain/workspace-members"
import type { SaveStaffRequest } from "../../application/save-staff.contracts"
import type { SaveStaffInput } from "./dto/save-staff.input"
import type { StaffOptionType } from "./dto/staff-option.type"

/** Maps the staff input, with the workspace it names, to the command request. */
export const toSaveStaffRequest = (workspaceId: string, input: SaveStaffInput): SaveStaffRequest => ({
    workspaceId,
    id: input.id,
    name: input.name,
    role: input.role,
    email: input.email,
    active: input.active,
})

/** Maps the saved staff row to the GraphQL type. */
export const toSavedStaffType = (staff: StaffOption): StaffOptionType => ({ ...staff })
