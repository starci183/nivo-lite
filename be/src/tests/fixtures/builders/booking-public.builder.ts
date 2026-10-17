import { builder } from "@starci/jest-preset"
import type { BookingPublicService } from "@modules/domain/bookings"

type PublicBookParams = Parameters<BookingPublicService["book"]>[0]
type WorkspaceBookParams = Parameters<BookingPublicService["requestIn"]>[0]
type PublicBookResult = Awaited<ReturnType<BookingPublicService["book"]>>

export const WORKSPACE = "ws-1"
export const PAGE = {
    workspace_id: WORKSPACE,
    public_note: "Note",
    address: "1 Main St",
    timezone: "Asia/Ho_Chi_Minh",
    shop: "Spa Anna",
}
/** Sunday noon in Ho Chi Minh City, before Monday's hours from 09:00. */
export const NOW = Date.UTC(2026, 9, 11, 5, 0)
export const MONDAY_NINE = "2026-10-12T02:00:00.000Z"
export const HOUR = 3_600_000
export const CHAT_KEY = `chat:job-1:${MONDAY_NINE}`
export const CHAT_LINK = { conversationId: "conversation-1", leadId: "lead-1" }
export const ALTERNATIVES = ["2026-10-12T03:00:00.000Z", "2026-10-12T04:00:00.000Z", "2026-10-12T05:00:00.000Z"]
export const REQUEST_DETAILS = {
    serviceId: "s1",
    start: MONDAY_NINE,
    name: " Mai ",
    phone: "0912 345 678",
    party: 1,
    note: " first visit ",
}
export const bookingRequestOf = builder<PublicBookParams>({
    ...REQUEST_DETAILS,
    slug: "spa-anna",
    email: "Mai@Example.com",
    token: "",
    website: "",
})
export const workspaceRequestOf = builder<WorkspaceBookParams>({
    ...REQUEST_DETAILS,
    workspaceId: WORKSPACE,
    email: "",
    token: CHAT_KEY,
    sourceChannel: "chat",
})
export const replyOf = builder<PublicBookResult>({
    ok: true,
    state: "confirmed",
    code: "confirmed",
    serviceName: "Cut",
    startIso: MONDAY_NINE,
    alternatives: [],
    bookingId: "b1",
})
/** Expected next cancellable booking for a linked or unlinked lead. */
export const nextReplyOf = (leadId: string | null) => ({
    id: "b-next",
    leadId,
    customerName: "Mai",
    serviceName: "Cut",
    startIso: MONDAY_NINE,
})
interface RequestFailure {
    readonly label: string
    readonly cause: unknown
    readonly request: WorkspaceBookParams
    readonly key: string | null
    readonly reads: number
}
export const failureOf = builder<RequestFailure>({
    label: "uncoded",
    cause: {},
    request: workspaceRequestOf(),
    key: CHAT_KEY,
    reads: 1,
})
