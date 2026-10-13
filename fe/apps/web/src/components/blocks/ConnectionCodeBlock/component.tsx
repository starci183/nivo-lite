import { Button, FencedCodeBlock } from "@starci/grammar/common"

/** A copy-ready code block. */
export interface ConnectionCodeBlockBaseProps {
    readonly props: {
        readonly code: string
        readonly label?: string
        readonly actionLabel: string
    }
    readonly on: {
        readonly copy: () => void
    }
}

/** Grammar's FencedCodeBlock owns the frame, inset and overflow; the copy button sits in its action slot. */
export const ConnectionCodeBlockBase = (props: ConnectionCodeBlockBaseProps) => (
    <FencedCodeBlock
        code={props.props.code}
        label={props.props.label}
        action={
            <Button variant="outline" size="sm" onPress={props.on.copy}>
                {props.props.actionLabel}
            </Button>
        }
    />
)
