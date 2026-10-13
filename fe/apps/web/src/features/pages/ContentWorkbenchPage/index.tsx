import { ContentWorkbenchPageBase } from "./component"
import type { ContentWorkbenchTab } from "./component"

/** Address inputs passed by the route to the content workbench. */
interface ContentWorkbenchPageProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installationId?: string | null
    readonly installation?: { readonly id: string }
}

const TABS: ReadonlyArray<ContentWorkbenchTab> = ["calendar", "list", "queue", "balance", "settings"]

/** Server shell of the content workbench; every block below it reads its own data in the browser through GraphQL hooks. */
const ContentWorkbenchPage = (props: ContentWorkbenchPageProps) => (
    <ContentWorkbenchPageBase
        props={{
            installationId: props.installation?.id ?? props.installationId ?? null,
            tab: TABS.find((entry) => entry === props.tab) ?? "calendar",
            focus: props.focus ?? null,
        }}
    />
)

export default ContentWorkbenchPage
