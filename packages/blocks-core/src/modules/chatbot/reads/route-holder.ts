import type { MemberDirectory, RouteHolds } from "@nivo-lite/agent-sdk/platform"
import { inboxStatusOf, type InboxStatus } from "../../../rules/chatbot"

/** Who holds a chat's route as a read shows it: the member's name, empty while the AI answers. */
export interface RouteHolder {
    /** Whether a staff member holds the route. */
    readonly held: boolean
    /** The name of the member who holds it; empty while nobody does (or the member left the workspace). */
    readonly handledBy: string
}

/** Nobody holds it. */
const FREE: RouteHolder = { held: false, handledBy: "" }

/**
 * Who holds the chat's route: the ENGINE's staff hold (`platform.route-holds`, ruling R43: the route is the one place that says it, the
 * chat stores no holder), named from the members. A chat with no route is held by nobody. A hold whose member left the workspace is still
 * a hold (the send door refuses the AI), shown with no name.
 */
export const routeHolderOf = async (holds: RouteHolds, members: MemberDirectory, routeId: string | null): Promise<RouteHolder> => {
    if (routeId === null || routeId === "") return FREE
    const hold = await holds.holderOf(routeId)
    if (hold === null) return FREE
    const member = await members.get(hold.memberId)
    return { held: true, handledBy: member?.displayName ?? "" }
}

/** A chat a read joins its holder to: its route and its open question. */
export interface HeldWindow {
    /** The engine's route of the chat; null on a chat no route was written on yet. */
    readonly routeId: string | null
    /** Whether a question waits for a person (the chat's own mark). */
    readonly waiting: boolean
}

/** The status a chat is shown with and who holds it, from its own open question and the route's hold. */
export interface ShownHolder {
    readonly status: InboxStatus
    readonly handledBy: string
}

/** The shown status and holder of one chat. */
export const shownHolderOf = async (holds: RouteHolds, members: MemberDirectory, chat: HeldWindow): Promise<ShownHolder> => {
    const holder = await routeHolderOf(holds, members, chat.routeId)
    return { status: inboxStatusOf({ waiting: chat.waiting, held: holder.held }), handledBy: holder.handledBy }
}

/** The rows of a page, each with its shown status and holder joined, in the same order: one bounded port call per chat of the page. */
export const withHolders = <T extends HeldWindow>(
    holds: RouteHolds,
    members: MemberDirectory,
    rows: ReadonlyArray<T>,
): Promise<ReadonlyArray<T & ShownHolder>> =>
    Promise.all(rows.map(async (row) => ({ ...row, ...(await shownHolderOf(holds, members, row)) })))
