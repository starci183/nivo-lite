import { Alert, Button } from "@starci/grammar/common"
import { WizardConsentCopy } from "@/components/composites/WizardConsentCopy"
import { WizardFrame } from "@/components/composites/WizardFrame"

/** Copy, state and commands of the Google wizard. */
export interface GoogleWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        /** 0 asks for the consent, 1 is the landing after Google answered. */
        readonly index: number
        /** The negative sentence when Google did not connect, null otherwise. */
        readonly refusal: string | null
        readonly error: string | null
        readonly isPending: boolean
        readonly text: Readonly<
            Record<
                | "allowTitle"
                | "allowOnlyFiles"
                | "allowNoOthers"
                | "allowRevoke"
                | "connect"
                | "close"
                | "done"
                | "failTitle"
                | "doneTitle"
                | "doneBody",
                string
            >
        >
    }
    readonly on: {
        readonly connect: () => void
        readonly close: (changed: boolean) => void
    }
}

/** Draws Google in the shared wizard frame: what NIVO is allowed, then Connect, then Done. */
export const GoogleWizardBase = (props: GoogleWizardBaseProps) => {
    const view = props.props
    const text = view.text
    const footer =
        view.index === 0 ? (
            <>
                <Button intent="commit" isPending={view.isPending} onPress={props.on.connect}>
                    {text.connect}
                </Button>
                <Button intent="neutral" isDisabled={view.isPending} onPress={() => props.on.close(false)}>
                    {text.close}
                </Button>
            </>
        ) : (
            <Button intent="commit" onPress={() => props.on.close(true)}>
                {text.done}
            </Button>
        )
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={footer}
        >
            {view.index === 0 ? (
                <WizardConsentCopy
                    title={text.allowTitle}
                    lines={[text.allowOnlyFiles, text.allowNoOthers, text.allowRevoke]}
                    refusal={view.refusal}
                    failTitle={text.failTitle}
                />
            ) : (
                <Alert tone="affirmative" title={`${text.doneTitle}. ${text.doneBody}`} />
            )}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}
