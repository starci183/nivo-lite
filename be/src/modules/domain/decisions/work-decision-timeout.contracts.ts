import type { WorkItem } from "./decisions.contracts"

/** The decision owner state while its row is locked against a human reopen. */
export type WorkTimeoutClaim =
    | { readonly kind: "busy" }
    | { readonly kind: "open" }
    | { readonly kind: "closed"; readonly item: WorkItem; readonly memberId: string | null }
