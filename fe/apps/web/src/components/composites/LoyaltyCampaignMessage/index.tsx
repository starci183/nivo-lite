import { Button, Input, Text, Textarea } from "@starci/grammar/common"
import { FORM_CLASS_NAME } from "./classNames"
/** Inputs and commands for the LoyaltyCampaignMessage presentation. */
interface LoyaltyCampaignMessageProps {
    readonly props: {
        readonly copy: {
            readonly name: string
            readonly nameHint: string
            readonly brief: string
            readonly briefHint: string
            readonly submit: string
            readonly drafting: string
        }
        readonly values: {
            readonly name: string
            readonly brief: string
        }
        readonly briefError?: string | undefined
        readonly briefMax: number
        readonly isBusy: boolean
        readonly isDrafting: boolean
        readonly isSubmitDisabled: boolean
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly setBrief: (value: string) => void
        readonly submit: () => void
    }
}

/** Offer name and message fields, submission and drafting feedback. */
export const LoyaltyCampaignMessage = (props: LoyaltyCampaignMessageProps) => {
    const { copy, values, briefError } = props.props
    const on = props.on
    return (
        <div className={FORM_CLASS_NAME}>
            <Input
                id="promo-name"
                name="name"
                label={copy.name}
                hint={copy.nameHint}
                value={values.name}
                isDisabled={props.props.isBusy}
                onValueChange={on.setName}
            />
            <Textarea
                label={copy.brief}
                description={copy.briefHint}
                errorMessage={briefError}
                rows={4}
                maxLength={props.props.briefMax}
                value={values.brief}
                isRequired
                isDisabled={props.props.isBusy}
                onValueChange={on.setBrief}
            />
            <div>
                <Button
                    intent="commit"
                    isPending={props.props.isBusy}
                    isDisabled={props.props.isSubmitDisabled}
                    onPress={on.submit}
                >
                    {copy.submit}
                </Button>
            </div>
            {props.props.isDrafting ? (
                <Text size="sm" tone="muted" live="polite">
                    {copy.drafting}
                </Text>
            ) : null}
        </div>
    )
}
