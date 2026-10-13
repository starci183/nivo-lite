import type { FoundingMemberRequest } from "../../application/founding-member.contracts"

/** Maps the workspace selector to the application request. */
export const toFoundingMemberRequest = (workspaceId: string): FoundingMemberRequest => ({ workspaceId })

/** Maps the service result to its GraphQL output. */
export const toFoundingMemberType = (result: boolean): boolean => result
