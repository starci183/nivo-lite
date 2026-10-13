import { navigation } from "@/modules/i18n"
import { getLocale } from "next-intl/server"
import { isModuleKey } from "@/modules/catalog"
import { AGENTS_ROUTE, agentHref } from "@/modules/installations"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The setup alias of an instance lives at the url of the instance itself. */
const Page = async (props: PageProps) => {
    const { module, installation } = await props.params
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return navigation.redirect({ href: isModuleKey(module) ? agentHref(module, installation) : AGENTS_ROUTE, locale })
}

export default Page
