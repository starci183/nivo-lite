import { Alert, Button, Input, SurfaceCard } from "@starci/grammar/common"
import { ACTIONS, STACK } from "./classNames"

/** Copy and state of the reply card of a chatbot. */
export interface AgentReplyCardBaseProps {
    readonly props: {
        readonly title: string
        readonly timeoutLabel: string
        readonly timeoutHint: string
        readonly timeout: string
        readonly canSaveTimeout: boolean
        readonly holdingLabel: string
        readonly holdingHint: string
        readonly holdingPlaceholder: string
        readonly holding: string
        readonly canSaveHolding: boolean
        readonly saveLabel: string
        readonly isPending: boolean
        readonly noteTone: "idle" | "saved" | "refused"
        readonly noteTitle: string
        readonly noteText: string
    }
    readonly on: {
        readonly timeout: (value: string) => void
        readonly holding: (value: string) => void
        readonly saveTimeout: () => void
        readonly saveHolding: () => void
    }
}

/** Draws the reply card of a chatbot: the longest a customer waits before the app answers directly, and the holding message. */
export const AgentReplyCardBase = (props: AgentReplyCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <Input
                id="reply-timeout"
                name="reply-timeout"
                label={props.props.timeoutLabel}
                variant="secondary"
                hint={props.props.timeoutHint}
                value={props.props.timeout}
                isDisabled={props.props.isPending}
                onValueChange={props.on.timeout}
            />
            <div className={ACTIONS}>
                <Button
                    variant="secondary"
                    isPending={props.props.isPending}
                    isDisabled={!props.props.canSaveTimeout}
                    onPress={props.on.saveTimeout}
                >
                    {props.props.saveLabel}
                </Button>
            </div>
            <Input
                id="holding-message"
                name="holding-message"
                label={props.props.holdingLabel}
                variant="secondary"
                hint={props.props.holdingHint}
                placeholder={props.props.holdingPlaceholder}
                value={props.props.holding}
                isDisabled={props.props.isPending}
                onValueChange={props.on.holding}
            />
            <div className={ACTIONS}>
                <Button
                    variant="secondary"
                    isPending={props.props.isPending}
                    isDisabled={!props.props.canSaveHolding}
                    onPress={props.on.saveHolding}
                >
                    {props.props.saveLabel}
                </Button>
            </div>
            {props.props.noteTone === "idle" ? null : (
                <Alert
                    title={props.props.noteTitle}
                    description={props.props.noteTone === "saved" ? undefined : props.props.noteText}
                    tone={props.props.noteTone === "saved" ? "affirmative" : "negative"}
                />
            )}
        </div>
    </SurfaceCard>
)
