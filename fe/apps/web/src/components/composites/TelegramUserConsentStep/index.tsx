import { CheckboxGroup, Grid, Input, Section, Text } from "@starci/grammar/common"
import type { TelegramUserWizardCopy } from "@/modules/types"

/** The already worded consent, editable name and prerequisite guard. */
interface TelegramUserConsentStepProps {
    readonly name: string
    readonly isChecked: boolean
    readonly isDisabled: boolean
    readonly isLoading: boolean
    readonly text: Pick<
        TelegramUserWizardCopy,
        "nameLabel" | "nameHint" | "consentTitle" | "consent1" | "consent2" | "consent3" | "consentLabel"
    >
    readonly onName: (value: string) => void
    readonly onConsent: (checked: boolean) => void
}

/** Draws the same name, three consent paragraphs and commitment checkbox. */
export const TelegramUserConsentStep = (props: TelegramUserConsentStepProps) => (
    <>
        <Grid kind="form">
            <Input
                id="tgu-name"
                name="name"
                isLoading={props.isLoading}
                label={props.text.nameLabel}
                description={props.text.nameHint}
                isDisabled={props.isDisabled}
                value={props.name}
                onValueChange={props.onName}
            />
        </Grid>
        <Section title={props.text.consentTitle} headingLevel={4} isLoading={props.isLoading}>
            <Text size="sm">{props.text.consent1}</Text>
            <Text size="sm">{props.text.consent2}</Text>
            <Text size="sm">{props.text.consent3}</Text>
            <CheckboxGroup
                label={props.text.consentTitle}
                isLabelHidden
                isLoading={props.isLoading}
                options={[{ value: "yes", label: props.text.consentLabel }]}
                value={props.isChecked ? ["yes"] : []}
                onValueChange={(value) => props.onConsent(value.includes("yes"))}
            />
        </Section>
    </>
)
