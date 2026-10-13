import { useMemo } from "react"
import type { DbOutcome } from "@/modules/db/outcome"
import type { InviteResultItem } from "@/modules/db/team/team.mapper"
import {
    writeInviteCreate,
    writeInviteLink,
    writeInviteResend,
    writeInviteRevoke,
} from "@/modules/db/team/write-invites"

/** What a person types to invite someone. */
export interface InviteInput {
    readonly email: string
    readonly role: "manager" | "staff"
    /** The staff row the account will be, or null. */
    readonly staffId: string | null
}

/** The calls the invitation blocks make to the database. */
export interface InviteCommands {
    readonly create: (input: InviteInput) => Promise<DbOutcome<InviteResultItem>>
    readonly resend: (inviteId: string) => Promise<DbOutcome<InviteResultItem>>
    readonly copyLink: (inviteId: string) => Promise<DbOutcome<InviteResultItem>>
    readonly revoke: (inviteId: string) => Promise<DbOutcome<null>>
}

/** The invitation commands of one workspace, run as Server Actions; the database proves the role. */
export const useInviteCommands = (workspaceId: string): InviteCommands =>
    useMemo<InviteCommands>(
        () => ({
            create: (input) => writeInviteCreate(workspaceId, input),
            resend: (inviteId) => writeInviteResend(workspaceId, inviteId),
            copyLink: (inviteId) => writeInviteLink(workspaceId, inviteId),
            revoke: (inviteId) => writeInviteRevoke(workspaceId, inviteId),
        }),
        [workspaceId],
    )
