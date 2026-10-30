import { refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { DirectoryAccount } from "./workspace-members.contracts"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"

/** The account of a user in an app that composes no account directory (it signs nobody in): there is none to show. */
export const noAccount = (): Promise<Outcome<DirectoryAccount, string>> =>
    Promise.resolve(refused(WorkspaceMembersErrorCode.MemberNotFound))
