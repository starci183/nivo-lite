import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectionsOverlayHost, ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"
import { URL_PARAMS } from "@/hooks/connections"

/** The query string of the request, awaited by the route. */
type ConnectionsPageProps = {
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the Connections page. */
export const connectionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("connections")
    return { title: t("title") }
}

/**
 * The Connections page (owner | manager): a server shell. The proxy gates the route; the board of what is connected and the connector
 * library are read in the browser from the back end GraphQL API by the feature host, and the wizard and the connector detail
 * open as drawers driven by the URL.
 */
export const ConnectionsPage = async (props: ConnectionsPageProps) => {
    const params = (await props.searchParams) ?? {}
    const tab = params[URL_PARAMS.tab]
    return (
        <ConnectionsOverlayHost
            tab={typeof tab === "string" ? tab : undefined}
            candidate={
                <>
                    <ConnectionWizardOverlay />
                    <ConnectorDetailOverlay />
                </>
            }
        />
    )
}
