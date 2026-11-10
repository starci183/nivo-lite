import type { ReactNode } from "react"
import { TelegramConnectionHead } from "@/components/blocks/TelegramConnectionHead"

/** What the layout supplies: the connection of the url and the routed tab. */
export interface TelegramConnectionLayoutBaseProps {
    readonly children?: ReactNode
    readonly props: { readonly connectionId: string }
}

/** Draws the page of a Telegram bot connection: the connected band (the one Page, with its tabs) around the routed tab's body. */
export const TelegramConnectionLayoutBase = (props: TelegramConnectionLayoutBaseProps) => (
    <TelegramConnectionHead connectionId={props.props.connectionId}>{props.children}</TelegramConnectionHead>
)
