import { Input } from "@starci/grammar/common"
import { WizardCopyGlyphs } from "@/components/leaves/WizardCopyGlyphs"
import type { RowCopyLabels } from "@/modules/types"

/** A read-only value the owner copies in place; a secret also shows or hides. */
type ConnectionCopyInputProps = {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly value: string
    readonly isSecret?: boolean
    readonly labels: RowCopyLabels
}

/** One copyable read-only field (a webhook URL, an API key) with the copy glyph inside the field. */
export const ConnectionCopyInput = (props: ConnectionCopyInputProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        variant="secondary"
        value={props.value}
        isReadOnly
        {...(props.isSecret === true ? { kind: "password" as const } : {})}
        isCopyable
        copyLabel={props.labels.copy}
        copiedLabel={props.labels.copied}
        copyIcon={WizardCopyGlyphs.copy}
        copiedIcon={WizardCopyGlyphs.copied}
        revealLabel={props.labels.reveal}
        hideLabel={props.labels.hide}
        revealIcon={WizardCopyGlyphs.reveal}
        hideIcon={WizardCopyGlyphs.hide}
    />
)
