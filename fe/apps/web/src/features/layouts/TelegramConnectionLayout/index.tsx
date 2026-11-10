import type { ReactElement, ReactNode } from "react"
import { TelegramConnectionLayoutBase } from "./component"

/** What the route hands the layout: its path and the routed tab. */
type TelegramConnectionLayoutProps = {
    readonly children?: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The frame of every tab of a Telegram bot connection page: the band stays while the tab's body changes. */
export const TelegramConnectionLayout = async (props: TelegramConnectionLayoutProps): Promise<ReactElement> => {
    const { id } = await props.params
    return <TelegramConnectionLayoutBase props={{ connectionId: id }}>{props.children}</TelegramConnectionLayoutBase>
}
