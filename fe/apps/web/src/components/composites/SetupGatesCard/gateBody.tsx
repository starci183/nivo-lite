import { Button, Textarea } from "@starci/grammar/common"
import { GATE_ACTIONS } from "./classNames"
import { SetupGatesCardEvidence } from "./component"
import type { SetupGate, SetupGatesCardProps } from "./types"

/** Renders the SetupGatesCard evidence section. */
export const renderSetupGatesCardEvidence = (
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
            </div>
        )}
    </>
)

/** Renders the SetupGatesCard edit section. */
export const renderSetupGatesCardEdit = (
    gate: Pick<SetupGate, "key" | "label" | "hint">,
    props: SetupGatesCardProps,
) => (
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
