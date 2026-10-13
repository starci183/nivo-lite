import type { WorkspaceRef, LoyaltyProgramSettings } from "../../application/get-loyalty-program.contracts"
import type { LoyaltyProgramSettingsType } from "./dto/loyalty-program-settings.type"

/** Maps workspace selection into the application request. */
export const toLoyaltyProgramRequest = (workspaceId: string): WorkspaceRef => ({ workspaceId })

/** Maps the application result into the GraphQL fields. */
export const toLoyaltyProgramType = (result: LoyaltyProgramSettings): LoyaltyProgramSettingsType => ({ ...result })
