import { GlobalErrorNotice } from "@/components/composites/GlobalErrorNotice"
import { DEFAULT_LOCALE } from "@/modules/i18n"
import messages from "@/modules/i18n/messages/vi.json"

type LandingGlobalErrorPageProps = { readonly onRetry: () => void }

/** The provider-free last-resort boundary reads the default catalog directly. */
export const LandingGlobalErrorPage = (props: LandingGlobalErrorPageProps) => (
    <GlobalErrorNotice
        lang={DEFAULT_LOCALE}
        title={messages.app.errors.global.title}
        retryLabel={messages.app.errors.global.retry}
        onRetry={props.onRetry}
    />
)
