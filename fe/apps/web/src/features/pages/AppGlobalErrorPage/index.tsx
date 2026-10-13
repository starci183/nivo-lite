import all from "@/modules/i18n/messages/vi.json"

const messages = all.app
import { DEFAULT_LOCALE } from "@/modules/i18n"
import { AppGlobalErrorPageBase } from "./component"

type AppGlobalErrorPageProps = { readonly onRetry: () => void }

/** The provider-free last-resort boundary reads the default catalog directly. */
export const AppGlobalErrorPage = (props: AppGlobalErrorPageProps) => (
    <AppGlobalErrorPageBase
        props={{
            lang: DEFAULT_LOCALE,
            title: messages.globalErrorTitle,
            text: messages.globalErrorText,
            retryLabel: messages.retry,
        }}
        on={{ retry: props.onRetry }}
    />
)
