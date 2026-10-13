import { useTranslations } from "next-intl"
import { ConsoleErrorPageBase } from "./component"

/** What the failed console route gives the page. */
interface ConsoleErrorPageProps {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** STATE-8 case-5, last resort: a console route without its own error view keeps the shell trail and heading. */
export const ConsoleErrorPage = (props: ConsoleErrorPageProps) => {
    const t = useTranslations("shell")
    return <ConsoleErrorPageBase props={{ crumbHome: t("crumbHome") }} on={{ retry: props.onRetry }} />
}
