import type { TeamChatState } from "@/hooks/teamChat"
import type { SlotLabels } from "@/modules/types"
import { handlersOf } from "./handlers"
import type { TeamChatHandlers, TeamChatViewProps } from "./types"
import { viewPropsOf } from "./view"
import type { ViewContext } from "./view"

/** What the surface of the chat is made of: the state of it, the words, the pane frame and the way to the full page. */
interface SurfaceInput {
    readonly chat: TeamChatState
    readonly t: ViewContext["t"]
    readonly pane: ViewContext["pane"]
    readonly labels: SlotLabels
    /** The page opened on an agent: the first message to it opens the room. */
    readonly withAgent: boolean
    readonly phone: { readonly showMain: () => void; readonly showList: () => void }
    readonly grid: TeamChatViewProps["grid"]
}

/** The surface of the chat: what it draws and what it asks of its owner. */
interface Surface {
    readonly props: TeamChatViewProps
    readonly on: TeamChatHandlers
}

/** The pure half's props and handlers for the resolved world of the chat. */
export const surfaceOf = (input: SurfaceInput): Surface => ({
    props: viewPropsOf(
        { chat: input.chat, t: input.t, pane: input.pane, withAgent: input.withAgent, labels: input.labels },
        input.grid,
    ),
    on: handlersOf(input.chat, {
        showMain: input.phone.showMain,
        showList: input.phone.showList,
    }),
})
