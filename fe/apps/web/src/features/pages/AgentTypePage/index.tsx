import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { carriedQuery } from "@/hooks/installations"
import { MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
import { AgentTypePageBase } from "./component"

/** What the route hands the page: the type of the url and its query. */
type AgentTypePageProps = {
    readonly module: string
    readonly search: Readonly<Record<string, string | string[] | undefined>>
}

/** What the metadata of the route hands the page: the type of the url. */
type AgentTypeMetadataProps = { readonly module: string }

/** The document title of the list of the instances of a type. */
export const agentTypeMetadata = async (props: AgentTypeMetadataProps): Promise<Metadata> => {
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return { title: isModuleKey(props.module) ? pickCopy(MODULE_REGISTRY[props.module].name, locale) : "" }
}

/**
 * The type of an agent: the connected block opens the only instance directly (its Setup tab); several instances, or the list flag, show
 * the list of instances with the way to add a new one for multi-instance types. Not installed: back to the catalogue.
 */
export const AgentTypePage = (props: AgentTypePageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentTypePageBase
            props={{ module: props.module, query: carriedQuery(props.search), showList: Boolean(props.search.list) }}
        />
    )
}
