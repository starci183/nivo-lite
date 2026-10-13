import { getLocale } from "next-intl/server"
import { navigation } from "@/modules/i18n"

/** Where an old onboarding url goes and the query it carries along. */
type OnboardingRedirectPageProps = {
    readonly target: string
    readonly search?: Readonly<Record<string, string | undefined>>
}

/** The onboarding urls were replaced by the workspaces area: they forward there, keeping the query. */
export const OnboardingRedirectPage = async (props: OnboardingRedirectPageProps) => {
    const query = new URLSearchParams()
    for (const [name, value] of Object.entries(props.search ?? {})) if (value) query.set(name, value)
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return navigation.redirect({ href: query.size > 0 ? `${props.target}?${query.toString()}` : props.target, locale })
}
