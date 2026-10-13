import { useQueryAuthoritySwr } from "@/hooks/swr/api/graphql/queries/useQueryAuthoritySwr"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { toAuthoritySheet } from "@/modules/authority"
import type { AuthoritySheet } from "@/modules/authority"

/** The goals, policies, limits note and rules of the active workspace, read from the back end through SWR (with a reload). */
export const useAuthoritySheet = (): {
    readonly slot: DataSlot<AuthoritySheet>
    readonly reload: () => void
} => {
    const read = useQueryAuthoritySwr()
    const sheet: AuthoritySheet | undefined = read.data === undefined ? undefined : toAuthoritySheet(read.data)
    const reload = () => void read.mutate()
    return { slot: slotOfSwr({ data: sheet, error: read.error, isLoading: read.isLoading }), reload }
}
