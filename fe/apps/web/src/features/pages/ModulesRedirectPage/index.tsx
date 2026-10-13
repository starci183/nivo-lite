import { getLocale } from "next-intl/server"
import { isModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import { AGENTS_ROUTE } from "@/modules/routes"

/** What the old module url named: the module its install link carried, when any. */
interface ModulesRedirectPageProps {
    readonly module?: string
}

/** The module urls were replaced by /agents: the catalogue, or the type page of the module the install link named. */
export const ModulesRedirectPage = async (props: ModulesRedirectPageProps) =>
    navigation.redirect({
        href: isModuleKey(props.module) ? agentHref(props.module, null) : AGENTS_ROUTE,
        locale: await getLocale(),
    })
