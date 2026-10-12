import { Alert, PageContainer } from "@starci/grammar/common"

/** Props for the pure last-resort error page. */
export type AppGlobalErrorPageBaseProps = {
    readonly props: {
        readonly lang: string
        readonly title: string
        readonly text: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the provider-free last-resort failure with its own document. */
export const AppGlobalErrorPageBase = (props: AppGlobalErrorPageBaseProps) => (
    <html lang={props.props.lang}>
        <body className="min-h-dvh bg-background text-foreground antialiased">
            <PageContainer measure="reading">
                <Alert
                    tone="negative"
                    title={props.props.title}
                    description={props.props.text}
                    action={{ label: props.props.retryLabel, onAction: props.on.retry }}
                />
            </PageContainer>
        </body>
    </html>
)
