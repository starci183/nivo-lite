import { SegmentedControl } from "@starci/grammar/common"
import type { SepayEnvironment } from "@/modules/types"

/** Props for {@link SepayEnvironmentPickerBase}. */
export interface SepayEnvironmentPickerBaseProps {
    readonly props: {
        readonly label: string
        /** What the chosen environment does with the money it hears about. */
        readonly description: string
        readonly value: SepayEnvironment
        readonly options: ReadonlyArray<{ readonly value: SepayEnvironment; readonly label: string }>
        /** Only the owner switches; the read is not in yet, or a switch is on its way. */
        readonly isDisabled: boolean
        readonly isSkeleton: boolean
    }
    readonly on: { readonly change: (environment: SepayEnvironment) => void }
}

/** Draws the body of the first setup step: test or live, one value from two short options all worth seeing (SegmentedControl). */
export const SepayEnvironmentPickerBase = (props: SepayEnvironmentPickerBaseProps) => (
    <SegmentedControl
        label={props.props.label}
        isLabelHidden
        description={props.props.description}
        options={props.props.options.map((option) => ({ value: option.value, label: option.label }))}
        value={props.props.value}
        isDisabled={props.props.isDisabled}
        isSkeleton={props.props.isSkeleton}
        onValueChange={(value) => {
            const picked = props.props.options.find((option) => option.value === value)
            if (picked !== undefined) props.on.change(picked.value)
        }}
    />
)
