import type { ReactNode } from "react"
import { TelegramConnectionLayout } from "@/features/layouts/TelegramConnectionLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly id: string }>
}

/** The band of a Telegram bot connection page: the one Page of every tab under it. */
const Layout = (props: LayoutProps) => (
    <TelegramConnectionLayout params={props.params}>{props.children}</TelegramConnectionLayout>
)

export default Layout
