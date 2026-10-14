import { Input, Label, Region, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { WizardCopyGlyphs } from "@/components/branches/WizardCopyGlyphs"
import type { CopyLabels, GuideField, GuideScreen } from "@/modules/types"
import { wizardGuideViewClassNames as classNames } from "./classNames"

/** What the provider screens draw and report. */
type WizardGuideViewProps = {
    readonly screens: ReadonlyArray<GuideScreen>
    readonly copy: CopyLabels
    readonly isDisabled?: boolean
    /** The owner changed a value NIVO owns (the webhook name, the SePay API key). */
    readonly onEdit: (token: string, value: string) => void
    /** The owner pasted a value from the provider. */
    readonly onPaste: (field: string, value: string) => void
}

const fieldOf = (field: GuideField, props: WizardGuideViewProps) => {
    if (field.kind === "copy") {
        return (
            <Input
                key={field.id}
                id={`guide-${field.token}`}
                name={field.token}
                label={field.label}
                hint={field.hint}
                variant="secondary"
                kind={field.isSecret ? "password" : "text"}
                value={field.value}
                isReadOnly={!field.isEditable}
                isDisabled={props.isDisabled}
                isCopyable
                copyLabel={props.copy.copy}
                copiedLabel={props.copy.copied}
                copyIcon={WizardCopyGlyphs.copy}
                copiedIcon={WizardCopyGlyphs.copied}
                revealLabel={props.copy.reveal}
                hideLabel={props.copy.hide}
                revealIcon={WizardCopyGlyphs.reveal}
                hideIcon={WizardCopyGlyphs.hide}
                {...(field.isEditable ? { onValueChange: (value: string) => props.onEdit(field.token, value) } : {})}
            />
        )
    }
    if (field.kind === "paste") {
        return (
            <Input
                key={field.id}
                id={`guide-${field.field}`}
                name={field.field}
                label={field.label}
                variant="secondary"
                kind={field.isSecret ? "password" : "text"}
                hint={field.hint}
                isDisabled={props.isDisabled}
                value={field.value}
                onValueChange={(value) => props.onPaste(field.field, value)}
            />
        )
    }
    if (field.kind === "choose") {
        return (
            <Select
                key={field.id}
                name={field.id}
                label={field.label}
                description={field.hint}
                variant="secondary"
                isReadOnly
                options={[{ id: "provider-option", label: field.option }]}
                value="provider-option"
            />
        )
    }
    if (field.kind === "switch")
        return <Switch key={field.id} label={field.label} description={field.hint} isSelected isReadOnly />
    return (
        <Text key={field.id} size="sm" tone="muted">
            {field.text}
        </Text>
    )
}

/**
 * The provider's own screens, one per block: the screen's name as a `Label` outside a nested `SurfaceCard`, and inside it each
 * field drawn as the control the provider shows - values to copy (in-field copy), the choice to make as a read-only `Select`
 * already set to the right option, a setting to turn on as a read-only `Switch`, and the boxes to paste provider values into.
 */
export const WizardGuideView = (props: WizardGuideViewProps) => (
    <div className={classNames.screens}>
        {props.screens.map((screen) => (
            <Region key={screen.id} labelledBy={`guide-screen-${screen.id}`}>
                <div className={classNames.screen}>
                    <Label as="h4" id={`guide-screen-${screen.id}`}>
                        {screen.heading}
                    </Label>
                    <SurfaceCard depth="nested">
                        <div className={classNames.fields}>{screen.fields.map((field) => fieldOf(field, props))}</div>
                    </SurfaceCard>
                </div>
            </Region>
        ))}
    </div>
)
