import { useTranslations } from "next-intl"
import { LandingErrorPageBase } from "./component"

type LandingErrorPageProps = { readonly onRetry: () => void }

/** A render failure with the segment retry. */
export const LandingErrorPage = (props: LandingErrorPageProps) => {
    const t = useTranslations("app.errors.page")
    return <LandingErrorPageBase props={{ title: t("title"), retryLabel: t("retry") }} on={{ retry: props.onRetry }} />
}
