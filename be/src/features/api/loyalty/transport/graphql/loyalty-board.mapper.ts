import type { WorkspaceRef, LoyaltyBoard } from "../../application/get-loyalty-board.contracts"
import type { LoyaltyBoardType } from "./dto/loyalty-board.type"

/** Maps workspace selection into the application request. */
export const toLoyaltyBoardRequest = (workspaceId: string): WorkspaceRef => ({ workspaceId })

/** Maps the application result into the GraphQL fields. */
export const toLoyaltyBoardType = (result: LoyaltyBoard): LoyaltyBoardType => ({ ...result })
