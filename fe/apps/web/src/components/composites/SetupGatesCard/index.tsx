import { Alert, Badge, Button, List, ListRow, Meter, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { GATE_ACTIONS, GATE_BODY, STACK } from "./classNames"
import { SetupGatesCardEvidence } from "./component"

type GateTone = "neutral" | "warning" | "success"

/** One gate of the checklist in the reader language. */
type SetupGate = {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly status: string
    readonly statusLabel: string
    readonly statusTone: GateTone
    readonly evidence: string
}

/** The checklist, its progress, the apply command and what the last actions said. */
type SetupGatesCardProps = {
    readonly title: string
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    readonly gates: ReadonlyArray<SetupGate>
    readonly isLoading: boolean
    /** The key of the gate being edited; empty when none. */
    readonly editing: string
    readonly editText: string
    readonly evidencePlaceholder: string
    readonly isGating: boolean
    readonly gateFailureTitle: string
    readonly gateFailure: string
    readonly confirmLabel: string
    readonly unconfirmLabel: string
    readonly editLabel: string
    readonly editSaveLabel: string
    readonly editCancelLabel: string
    readonly applyLabel: string
    readonly isApplying: boolean
    readonly canApply: boolean
    readonly applyHint: string
    readonly applyTone: "idle" | "applied" | "refused"
    readonly applyTitle: string
    readonly applyText: string
    readonly onEditText: (value: string) => void
    readonly onGate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly onStartEdit: (gateKey: string, evidence: string) => void
    readonly onStopEdit: () => void
    readonly onApply: () => void
}

/** The gates the owner must confirm before the draft can be applied, with their evidence and the apply command. */
export const SetupGatesCard = (props: SetupGatesCardProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK}>
            <Meter
                label={props.progressLabel}
                value={props.confirmed}
                minValue={0}
                maxValue={props.total}
                isSkeleton={props.isLoading}
            />
            {props.gateFailure === "" ? null : (
                <Alert title={props.gateFailureTitle} description={props.gateFailure} tone="negative" />
            )}
            <List label={props.title}>
                {props.gates.map((gate) => (
                    <ListRow
                        key={gate.key}
                        title={gate.label}
                        badges={
                            <Badge isDot isSkeleton={props.isLoading} tone={gate.statusTone}>
                                {gate.statusLabel}
                            </Badge>
                        }
                    >
                        <div className={GATE_BODY}>
                            {props.editing === gate.key
                                ? renderSetupGatesCardEdit(gate, props)
                                : renderSetupGatesCardEvidence(gate, props)}
                        </div>
                    </ListRow>
                ))}
            </List>
            <div className={STACK}>
                <Button
                    intent="commit"
                    isSkeleton={props.isLoading}
                    isPending={props.isApplying}
                    isDisabled={!props.canApply}
                    onPress={props.onApply}
                >
                    {props.applyLabel}
                </Button>
                <Text size="xs" tone="muted" isSkeleton={props.isLoading}>
                    {props.applyHint}
                </Text>
                {props.applyTone === "idle" ? null : (
                    <Alert
                        title={props.applyTitle}
                        description={props.applyText}
                        tone={props.applyTone === "applied" ? "affirmative" : "negative"}
                    />
                )}
            </div>
        </div>
    </SurfaceCard>
)

/** Renders the SetupGatesCard evidence section. */
const renderSetupGatesCardEvidence = (
    gate: Pick<SetupGate, "hint" | "evidence" | "status" | "key">,
    props: SetupGatesCardProps,
) => (
    <>
        <SetupGatesCardEvidence hint={gate.hint} evidence={gate.evidence} isWaiting={props.isLoading} />
        {props.isLoading ? null : (
            <div className={GATE_ACTIONS}>
                {gate.status === "proposed" ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={props.isGating}
                        onPress={() => props.onGate(gate.key, "confirm")}
                    >
                        {props.confirmLabel}
                    </Button>
                ) : null}
                {gate.status === "confirmed" ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={props.isGating}
                        onPress={() => props.onGate(gate.key, "reopen")}
                    >
                        {props.unconfirmLabel}
                    </Button>
                ) : null}
                <Button intent="neutral" size="sm" onPress={() => props.onStartEdit(gate.key, gate.evidence)}>
                    {props.editLabel}
                </Button>
            </div>
        )}
    </>
)

/** Renders the SetupGatesCard edit section. */
const renderSetupGatesCardEdit = (gate: Pick<SetupGate, "key" | "label" | "hint">, props: SetupGatesCardProps) => (
    <>
        <Textarea
            name={`gate-${gate.key}`}
            label={gate.label}
            isLabelHidden
            description={gate.hint}
            rows={3}
            maxLength={800}
            placeholder={props.evidencePlaceholder}
            value={props.editText}
            onValueChange={props.onEditText}
        />
        <div className={GATE_ACTIONS}>
            <Button
                intent="commit"
                size="sm"
                isPending={props.isGating}
                isDisabled={props.editText.trim().length === 0}
                onPress={() => props.onGate(gate.key, "edit", props.editText)}
            >
                {props.editSaveLabel}
            </Button>
            <Button intent="neutral" size="sm" onPress={props.onStopEdit}>
                {props.editCancelLabel}
            </Button>
        </div>
    </>
)
