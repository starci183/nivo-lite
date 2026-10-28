import { Button, Text, Textarea } from "@starci/grammar/common"
import type { SetupGatesCardProps, SetupSideGate } from "@/modules/types"
import { ACTIONS, BODY, EVIDENCE } from "./classNames"

/** One gate of the checklist, whether it is being edited, and the words and commands of its body. */
type SetupGateBodyProps = Pick<
    SetupGatesCardProps,
    | "isSkeleton"
    | "isGating"
    | "editText"
    | "evidencePlaceholder"
    | "confirmLabel"
    | "unconfirmLabel"
    | "editSaveLabel"
    | "editCancelLabel"
    | "onEditText"
    | "onGate"
    | "onStopEdit"
> & {
    readonly gate: SetupSideGate
    readonly isEditing: boolean
}

/** The body of one gate: the evidence editor while it is edited, else its evidence with confirm or reopen. */
export const SetupGateBody = (props: SetupGateBodyProps) => (
    <div className={BODY}>{props.isEditing ? renderEdit(props) : renderEvidence(props)}</div>
)

/** The evidence of the gate (its hint while waiting or before evidence is supplied) and confirm or reopen. */
const renderEvidence = ({ gate, ...props }: SetupGateBodyProps) => {
    const isHint = props.isSkeleton || gate.evidence === ""
    return (
        <>
            <div className={EVIDENCE}>
                <Text size="sm" tone={isHint ? "muted" : "default"}>
                    {isHint ? gate.hint : gate.evidence}
                </Text>
            </div>
            <div className={ACTIONS}>
                {gate.status === "proposed" ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isSkeleton={props.isSkeleton}
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
                        isSkeleton={props.isSkeleton}
                        isPending={props.isGating}
                        onPress={() => props.onGate(gate.key, "reopen")}
                    >
                        {props.unconfirmLabel}
                    </Button>
                ) : null}
            </div>
        </>
    )
}

/** The evidence editor of the gate with save and cancel. */
const renderEdit = ({ gate, ...props }: SetupGateBodyProps) => (
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
        <div className={ACTIONS}>
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
