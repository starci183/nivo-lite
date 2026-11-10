import type { ReactElement } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { isProvider, providerKey } from "@/hooks/connection-providers"
import { providersOfSegment } from "@/modules/connection-groups"
import { ConnectionProviderPageBase } from "./component"

/** The provider segment the route supplies, awaited by the route. */
interface ConnectionProviderPageProps {
    readonly segment: string
}

/** The first provider a page address names, when it names one. */
const providerOf = (segment: string) => providersOfSegment(segment).find(isProvider)

/** The document title of a provider page: the provider's own title. */
export const connectionProviderMetadata = async (segment: string): Promise<Metadata> => {
    const t = await getTranslations("connections")
    const provider = providerOf(segment)
    return { title: provider === undefined ? t("title") : t(providerKey(provider, "title")) }
}

/**
 * The page of one provider under Connections (owner | manager): a server shell. A segment that names no provider is `notFound()`; the
 * connected block reads the connections in the browser and draws the Page.
 */
export const ConnectionProviderPage = (props: ConnectionProviderPageProps): ReactElement => {
    if (providerOf(props.segment) === undefined) notFound()
    return <ConnectionProviderPageBase props={{ segment: props.segment }} />
}
