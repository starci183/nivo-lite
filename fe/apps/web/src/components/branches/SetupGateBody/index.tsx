import { Button, Cluster, Stack, Text, Textarea } from "@starci/grammar/common"
import type { SetupGatesCardProps, SetupSideGate } from "@/modules/types"
import { EVIDENCE } from "./classNames"

/** One gate of the checklist, whether it is being edited, and the words and commands of its body. */
type SetupGateBodyProps = Pick<
    SetupGatesCardProps,
    | "isGating"
    | "editText"
    | "evidencePlaceholder"
    | "confirmLabel"
    | "editSaveLabel"
    | "editCancelLabel"
    | "understoodLabel"
    | "onEditText"
    | "onGate"
    | "onStopEdit"
> & {
    readonly isLoading: boolean
    readonly gate: SetupSideGate
    readonly isEditing: boolean
}

/** The body of one gate: the evidence editor while it is edited, else its evidence with confirm or reopen. */
export const SetupGateBody = (props: SetupGateBodyProps) => (
    <Stack gap="inline">{props.isEditing ? renderEdit(props) : renderEvidence(props)}</Stack>
)

/** What NIVO understood for the item, with confirm when it is a proposal. */
const renderEvidence = ({ gate, ...props }: SetupGateBodyProps) => (
    <>
        {gate.evidence === "" ? null : (
            <div className={EVIDENCE}>
                <Text size="sm">{`${props.understoodLabel} ${gate.evidence}`}</Text>
            </div>
        )}
        {gate.status === "proposed" ? (
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    size="sm"
                    isLoading={props.isLoading === true}
                    isPending={props.isGating}
                    onPress={() => props.onGate(gate.key, "confirm")}
                >
                    {props.confirmLabel}
                </Button>
            </Cluster>
        ) : null}
    </>
)

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
        <Cluster gap="inline">
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
        </Cluster>
    </>
)
