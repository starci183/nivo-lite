import { Alert, Text } from "@starci/grammar/common"
import type { ComponentProps } from "react"
import { WizardFrame, frameOf } from "@/components/composites/WizardFrame"
import { WizardConsentCopy } from "@/components/composites/WizardConsentCopy"
import { DriveFileChooser } from "@/components/composites/DriveFileChooser"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { driveWizardClassNames as classNames } from "./classNames"

/** The words of the wizard: its three steps' guidance and buttons. */
type DriveWizardText = Readonly<
    Record<
        | "allowTitle"
        | "allowRead"
        | "allowFiles"
        | "allowRevoke"
        | "connected"
        | "grant"
        | "close"
        | "later"
        | "done"
        | "doneBody"
        | "doneHint"
        | "failTitle",
        string
    >
>

/** Copy, state and commands of the Google Drive wizard. */
export interface DriveWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        /** 0 asks for the read access, 1 chooses documents, 2 is the landing after something was added. */
        readonly index: number
        /** The negative sentence when Google did not grant, null otherwise. */
        readonly refusal: string | null
        /** Why the grant did not start, worded by the back end; null when it did. */
        readonly error: string | null
        readonly isPending: boolean
        readonly chooser: ComponentProps<typeof DriveFileChooser>["props"]
        readonly text: DriveWizardText
    }
    readonly on: ComponentProps<typeof DriveFileChooser>["on"] & {
        readonly grant: () => void
        readonly close: (changed: boolean) => void
    }
}

/** The buttons of each step: ask for the access, leave for later, or finish. */
const actionsOf = (props: DriveWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text, index, isPending } = props.props
    if (index === 0) {
        return [
            { id: "grant", label: text.grant, intent: "alternative", isNext: true, isPending, onPress: props.on.grant },
            { id: "close", label: text.close, intent: "dismiss", isDisabled: isPending, onPress: () => props.on.close(false) },
        ]
    }
    if (index === 1) return [{ id: "later", label: text.later, intent: "neutral", onPress: () => props.on.close(true) }]
    return [{ id: "done", label: text.done, intent: "alternative", isNext: true, onPress: () => props.on.close(true) }]
}

/** Draws Google Drive in the shared wizard frame: what NIVO is allowed to read, then choosing documents, then Done. */
export const DriveWizardBase = (props: DriveWizardBaseProps) => {
    const view = props.props
    const text = view.text
    return (
        <WizardFrame {...frameOf(view)} actions={actionsOf(props)}>
            {view.index === 0 ? (
                <WizardConsentCopy
                    title={text.allowTitle}
                    lines={[text.allowRead, text.allowFiles, text.allowRevoke]}
                    refusal={view.refusal}
                    failTitle={text.failTitle}
                />
            ) : null}
            {view.index === 1 ? (
                <div className={classNames.copy}>
                    <Alert tone="affirmative" appearance="soft" title={text.connected} />
                    <DriveFileChooser props={view.chooser} on={props.on} />
                </div>
            ) : null}
            {view.index === 2 ? (
                <div className={classNames.copy}>
                    <Alert tone="affirmative" title={text.doneBody} />
                    <Text size="sm" tone="muted">
                        {text.doneHint}
                    </Text>
                </div>
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}
