import type { DataSlot, SlotLabels } from "@/modules/types"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Alert, Button, Cluster, Grid, Input, Section, Text } from "@starci/grammar/common"
import { WizardConsentCopy } from "@/components/composites/WizardConsentCopy"
import { WizardFrame } from "@/components/frames/WizardFrame"

/** Copy, state and commands of the Google wizard. */
export interface GoogleWizardBaseProps {
    readonly props: {
        readonly boot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        /** 0 asks for the consent, 1 is the landing after Google answered. */
        readonly index: number
        /** The negative sentence when Google did not connect, null otherwise. */
        readonly refusal: string | null
        readonly error: string | null
        readonly isPending: boolean
        /** The sentence that says the seeded Google connection waits for the owner's first consent, or null. */
        readonly consentNeeded: string | null
        /** The ledger kept in a Google spreadsheet: where it stands and the sheet being typed. */
        readonly ledger: {
            /** The sentence of where the ledger stands. */
            readonly status: string
            /** Whether the spreadsheets access must be asked (none or lost). */
            readonly mustAllow: boolean
            /** Whether a sheet can be named (the access is given). */
            readonly canName: boolean
            /** The sheet link or id being typed. */
            readonly sheet: string
            /** The sentence of what the last ledger step ended as, or null. */
            readonly note: string | null
            /** The address of the ledger sheet, blank until named. */
            readonly sheetUrl: string
            readonly text: Readonly<Record<"title" | "body" | "allow" | "sheetLabel" | "sheetHint" | "save", string>>
        }
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
        readonly allowSheets: () => void
        readonly sheet: (value: string) => void
        readonly saveSheet: () => void
        readonly close: (changed: boolean) => void
    }
}

/** Draws Google in the shared wizard frame: what NIVO is allowed, then Connect, then Done. */
const renderGoogleWizard = (props: GoogleWizardBaseProps, isLoading: boolean) => {
    const view = props.props
    const text = view.text
    const footer =
        view.index === 0 ? (
            <>
                <Button intent="commit" isPending={view.isPending} onPress={props.on.connect} isLoading={isLoading}>
                    {text.connect}
                </Button>
                <Button
                    intent="neutral"
                    isDisabled={view.isPending}
                    onPress={() => props.on.close(false)}
                    isLoading={isLoading}
                >
                    {text.close}
                </Button>
            </>
        ) : (
            <Button intent="commit" onPress={() => props.on.close(true)} isLoading={isLoading}>
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
                <Alert tone="affirmative" title={`${text.doneTitle}. ${text.doneBody}`} isLoading={isLoading} />
            )}
            {view.consentNeeded === null ? null : (
                <Alert tone="informative" title={view.consentNeeded} isLoading={isLoading} />
            )}
            <Section title={view.ledger.text.title} headingLevel={4}>
                <Text size="sm">{view.ledger.text.body}</Text>
                <Text size="sm" tone="muted">
                    {view.ledger.status}
                </Text>
                {view.ledger.note === null ? null : (
                    <Alert tone="affirmative" title={view.ledger.note} isLoading={isLoading} />
                )}
                {view.ledger.mustAllow ? (
                    <Cluster gap="inline">
                        <Button
                            intent="neutral"
                            isPending={view.isPending}
                            onPress={props.on.allowSheets}
                            isLoading={isLoading}
                        >
                            {view.ledger.text.allow}
                        </Button>
                    </Cluster>
                ) : null}
                {view.ledger.canName ? (
                    <Grid kind="form" columns={1}>
                        <Input
                            id="ledger-sheet"
                            name="ledgerSheet"
                            label={view.ledger.text.sheetLabel}
                            description={view.ledger.text.sheetHint}
                            isDisabled={view.isPending}
                            value={view.ledger.sheet}
                            onValueChange={props.on.sheet}
                            isLoading={isLoading}
                        />
                        <Cluster gap="inline">
                            <Button
                                intent="commit"
                                isPending={view.isPending}
                                isDisabled={view.ledger.sheet.trim() === ""}
                                onPress={props.on.saveSheet}
                                isLoading={isLoading}
                            >
                                {view.ledger.text.save}
                            </Button>
                        </Cluster>
                    </Grid>
                ) : null}
            </Section>
            {view.error === null ? null : <Alert tone="negative" title={view.error} isLoading={isLoading} />}
        </WizardFrame>
    )
}

/** Draws the selected wizard's existing ready tree from its actual dependency reads. */
export const GoogleWizardBase = (props: GoogleWizardBaseProps) => (
    <SlotView
        slot={props.props.boot}
        placeholder={true}
        labels={props.props.slotLabels}
        render={(_ready, isLoading) => renderGoogleWizard(props, isLoading)}
    />
)
