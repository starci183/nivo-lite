import { Page } from "@starci/grammar/common"
import { ZaloForward } from "@/components/blocks/ZaloForward"

/** What Zalo sends the browser back with, and the title of the page. */
export interface ZaloForwardPageBaseProps {
    readonly props: {
        readonly title: string
        readonly code: string | undefined
        readonly oaId: string | undefined
        readonly state: string | undefined
    }
}

/** Draws the forwarding block under the title of the Zalo return. */
export const ZaloForwardPageBase = (props: ZaloForwardPageBaseProps) => (
    <Page measure="reading" header={{ title: props.props.title }}>
        <ZaloForward code={props.props.code} oaId={props.props.oaId} state={props.props.state} />
    </Page>
)
