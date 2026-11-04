import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import { ConnectionSavedFacts } from "@/components/frames/ConnectionSavedFacts"
import type { ConnectionSavedFactsProps } from "@/components/frames/ConnectionSavedFacts"

/** Copy and slot of the first setup step: what the app keys stored. */
export interface ZaloAppStepBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        readonly facts: ConnectionSavedFactsProps["facts"]
        readonly slotLabels: ConnectionSavedFactsProps["slotLabels"]
    }
    readonly on: { readonly retry: () => void; readonly toggle: (isOpen: boolean) => void }
}

/** Draws the first setup step: the saved values of the app, every secret masked to its last four characters, as a description list. */
export const ZaloAppStepBase = (props: ZaloAppStepBaseProps) => (
    <ConnectionStepBand {...props.props.step} onToggle={props.on.toggle}>
        <ConnectionSavedFacts facts={props.props.facts} slotLabels={props.props.slotLabels} onRetry={props.on.retry} />
    </ConnectionStepBand>
)
