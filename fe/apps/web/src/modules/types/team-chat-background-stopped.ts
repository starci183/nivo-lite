import type { TeamChatMarkView } from "./team-chat-room"
import type { TeamChatStopLineView } from "./team-chat-stop"

/** The structured card of a message NIVO posts when work it does in the background stopped (`ChatMessageType.backgroundStopped`). */
export interface TeamChatBackgroundStopped {
    /** The closed code of the work that stopped; a code the web does not know reads as generic words. */
    readonly work: string
    /** The closed code of why it stopped (`model`, `credits`, `gave_up`, `ceiling`); an unknown code reads as generic words. */
    readonly reason: string
    /** When it stopped (ISO). */
    readonly since: string
    /** Which failure this is (ISO); one card per episode. */
    readonly episode: string
    /** Where the one way out leads. */
    readonly target: { readonly kind: string }
}

/** The way out of a card: its words and where it opens. */
export interface TeamChatBackgroundStoppedAction {
    readonly label: string
    readonly href: string
}

/** A "work stopped" card with every word resolved; the raw codes stay in `facts`, folded by the card. */
export interface TeamChatBackgroundStoppedView {
    readonly mark: TeamChatMarkView
    /** Who says it: NIVO's name. */
    readonly author: string
    /** The muted line under the name: the work and the time. */
    readonly meta: string
    readonly chip: string
    readonly title: string
    readonly message: string
    /** The one way to the place the work is retried; null for a target the web does not know. */
    readonly action: TeamChatBackgroundStoppedAction | null
    readonly detailsLabel: string
    readonly factsLabel: string
    readonly facts: ReadonlyArray<TeamChatStopLineView>
}
