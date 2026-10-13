import { useTranslations } from "next-intl"
import { OverviewErrorPageBase } from "./component"

/** What the route gives the failure view: the segment retry. */
interface OverviewErrorPageProps {
    readonly onRetry: () => void
}

/** The overview failure view with its copy resolved. */
export const OverviewErrorPage = (props: OverviewErrorPageProps) => {
    const shell = useTranslations("shell")
    const overview = useTranslations("overview")
    return (
        <OverviewErrorPageBase
            props={{ title: shell("crumbHome"), homeLabel: shell("crumbHome"), message: overview("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
