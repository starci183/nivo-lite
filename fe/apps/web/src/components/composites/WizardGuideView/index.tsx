import { Input, Select, Stack, Switch, Text, Section } from "@starci/grammar/common"
import { WizardCopyGlyphs } from "@/components/branches/WizardCopyGlyphs"
import type { CopyLabels, GuideField, GuideScreen } from "@/modules/types"

/** What the provider screens draw and report. */
type WizardGuideViewProps = {
    readonly isLoading?: boolean

    readonly screens: ReadonlyArray<GuideScreen>
    readonly copy: CopyLabels
    readonly isDisabled?: boolean
    /** The owner changed a value NIVO owns (the webhook name, the SePay API key). */
    readonly onEdit: (token: string, value: string) => void
    /** The owner pasted a value from the provider. */
    readonly onPaste: (field: string, value: string) => void
}

const fieldOf = (field: GuideField, props: WizardGuideViewProps) => {
    if (field.kind === "copy") return <GuideCopyField field={field} guide={props} />
    if (field.kind === "paste") {
        return (
            <Input
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                key={field.id}
                id={`guide-${field.field}`}
                name={field.field}
                label={field.label}
                kind={field.isSecret ? "password" : "text"}
                description={field.hint}
                {...(props.isDisabled === undefined ? {} : { isDisabled: props.isDisabled })}
                value={field.value}
                onValueChange={(value) => props.onPaste(field.field, value)}
            />
        )
    }
    if (field.kind === "choose") {
        return (
            <Select
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                key={field.id}
                name={field.id}
                label={field.label}
                description={field.hint}
                isReadOnly
                options={[{ id: "provider-option", label: field.option }]}
                value="provider-option"
            />
        )
    }
    if (field.kind === "switch")
        return (
            <Switch
                {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                key={field.id}
                label={field.label}
                description={field.hint}
                isSelected
                isReadOnly
            />
        )
    return (
        <Text key={field.id} size="sm" tone="muted">
            {field.text}
        </Text>
    )
}

/**
 * The provider's own screens, one named section each, with every
 * field drawn as the control the provider shows - values to copy (in-field copy), the choice to make as a read-only `Select`
 * already set to the right option, a setting to turn on as a read-only `Switch`, and the boxes to paste provider values into.
 */
export const WizardGuideView = (props: WizardGuideViewProps) => (
    <Stack gap="section">
        {props.screens.map((screen) => (
            <Section key={screen.id} title={screen.heading} headingLevel={4}>
                <Stack gap="row">{screen.fields.map((field) => fieldOf(field, props))}</Stack>
            </Section>
        ))}
    </Stack>
)

interface GuideCopyFieldProps {
    readonly field: Extract<GuideField, { readonly kind: "copy" }>
    readonly guide: WizardGuideViewProps
}
/** The copy/reveal field keeps the exact native copy and reveal controls. */
const GuideCopyField = (props: GuideCopyFieldProps) => {
    const { field, guide } = props
    return (
        <Input
            {...(guide.isLoading === undefined ? {} : { isLoading: guide.isLoading })}
            key={field.id}
            id={`guide-${field.token}`}
            name={field.token}
            label={field.label}
            description={field.hint}
            kind={field.isSecret ? "password" : "text"}
            value={field.value}
            isReadOnly={!field.isEditable}
            {...(guide.isDisabled === undefined ? {} : { isDisabled: guide.isDisabled })}
            isCopyable
            copyLabel={guide.copy.copy}
            copiedLabel={guide.copy.copied}
            copyIcon={WizardCopyGlyphs.copy}
            copiedIcon={WizardCopyGlyphs.copied}
            revealLabel={guide.copy.reveal}
            hideLabel={guide.copy.hide}
            revealIcon={WizardCopyGlyphs.reveal}
            hideIcon={WizardCopyGlyphs.hide}
            {...(field.isEditable ? { onValueChange: (value: string) => guide.onEdit(field.token, value) } : {})}
        />
    )
}
