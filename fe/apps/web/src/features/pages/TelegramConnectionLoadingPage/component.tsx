import { ConnectionPageLoading } from "@/components/blocks/ConnectionPageLoading"
import type { ConnectionPageLoadingProps } from "@/components/blocks/ConnectionPageLoading"

/** STATE-8: the Telegram bot page with no data yet, in the frame of the page itself. */
export const TelegramConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => (
    <ConnectionPageLoading {...props} />
)
