import type { InviteRead, InviteView } from "./useInviteView"

/** The invitation once it is read, or undefined while it loads, failed or is not read at all. */
export const inviteViewOf = (read: InviteRead): InviteView | undefined =>
    "items" in read.slot ? read.slot.items : undefined
