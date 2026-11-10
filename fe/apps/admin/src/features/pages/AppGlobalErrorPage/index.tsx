import { createTranslator } from "next-intl"
import { DEFAULT_LOCALE } from "@/modules/i18n"
import messages from "@/modules/i18n/messages/vi.json"
import { AppGlobalErrorPageBase } from "./component"

/** The provider-free translator of the last-resort boundary: the default catalog, read directly. */
const t = createTranslator({ locale: DEFAULT_LOCALE, messages })

/** What the root layout's global error boundary hands the page: the way to try again. */
interface AppGlobalErrorPageProps {
    readonly onRetry: () => void
}

/** The provider-free last-resort boundary reads the default catalog directly. */
export const AppGlobalErrorPage = (props: AppGlobalErrorPageProps) => (
    <AppGlobalErrorPageBase
        props={{
            lang: DEFAULT_LOCALE,
            title: t("app.globalErrorTitle"),
            text: t("app.globalErrorText"),
            retryLabel: t("app.retry"),
        }}
        on={{ retry: props.onRetry }}
    />
)
