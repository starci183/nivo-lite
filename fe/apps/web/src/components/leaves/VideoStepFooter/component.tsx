import { Button, Text } from "@starci/grammar/common"
import { FOOTER_END, FOOTER_ROW } from "./classNames"

/** Copy, state and handlers of a step footer. */
export interface VideoStepFooterBaseProps {
    readonly props: {
        readonly backLabel: string
        readonly nextLabel: string
        readonly note: string | null
        readonly pending: boolean
        readonly nextDisabled: boolean
    }
    readonly on: { readonly back: () => void; readonly next: () => void }
}

/** Draws the footer of a wizard step: the way back, an optional note and the one primary action. */
export const VideoStepFooterBase = (props: VideoStepFooterBaseProps) => (
    <div className={FOOTER_ROW}>
        <Button intent="neutral" isDisabled={props.props.pending} onPress={props.on.back}>
            {props.props.backLabel}
        </Button>
        <div className={FOOTER_END}>
            {props.props.note === null ? null : (
                <Text as="span" size="sm" tone="muted">
                    {props.props.note}
                </Text>
            )}
            <Button
                intent="commit"
                isPending={props.props.pending}
                isDisabled={props.props.nextDisabled}
                onPress={props.on.next}
            >
                {props.props.nextLabel}
            </Button>
        </div>
    </div>
)
