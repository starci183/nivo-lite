import { ZaloReturn } from "@/components/blocks/ZaloReturn"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
export interface ZaloCallbackPageBaseProps {
    readonly props: {
        readonly code: string | undefined
        readonly oaId: string | undefined
        readonly state: string | undefined
    }
}

/** Draws the Zalo return: the block that hands it to the back end. */
export const ZaloCallbackPageBase = (props: ZaloCallbackPageBaseProps) => (
    <ZaloReturn code={props.props.code} oaId={props.props.oaId} state={props.props.state} />
)
