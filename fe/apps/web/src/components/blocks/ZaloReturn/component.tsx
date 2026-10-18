import { Text } from "@starci/grammar/common"
import { WAIT_CLASS_NAME } from "./classNames"

/** The text the connected block supplies. */
export interface ZaloReturnBaseProps {
    readonly props: {
        readonly waiting: string
    }
}

/** Draws the line shown while the Zalo return is handed to the back end. */
export const ZaloReturnBase = (props: ZaloReturnBaseProps) => (
    <div className={WAIT_CLASS_NAME}>
        <output>
            <Text as="span" tone="muted">
                {props.props.waiting}
            </Text>
        </output>
    </div>
)
