import { Fragment } from "react"
import {
    Alert,
    Badge,
    Button,
    Divider,
    Heading,
    IconButton,
    List,
    ListRow,
    Meter,
    Region,
    Text,
    Tooltip,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { GATE_BODY, GATE_ROW, SECTION, STACK } from "./classNames"
import { renderSetupGatesCardEdit, renderSetupGatesCardEvidence } from "./gateBody"
import type { SetupGatesCardProps } from "./types"

/** The gates the owner must confirm before the draft can be applied, with their evidence and the apply command. */
export const SetupGatesCard = (props: SetupGatesCardProps) => (
    <Region label={props.title}>
        <div className={SECTION}>
            <Heading level={2}>{props.title}</Heading>
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
        </div>
        <List label={props.title}>
            {props.gates.map((gate) => (
                <Fragment key={gate.key}>
                    <Divider semantics="presentation" />
                    <div className={GATE_ROW}>
                        <ListRow
                            title={gate.label}
                            badges={
                                <Badge isDot isSkeleton={props.isLoading} tone={gate.statusTone}>
                                    {gate.statusLabel}
                                </Badge>
                            }
                            actions={
                                props.isLoading || props.editing === gate.key ? undefined : (
                                    <Tooltip content={props.editLabel}>
                                        <IconButton
                                            source={nivoIconSource("edit", "leading")}
                                            label={props.editLabel}
                                            intent="neutral"
                                            onPress={() => props.onStartEdit(gate.key, gate.evidence)}
                                        />
                                    </Tooltip>
                                )
                            }
                        >
                            <div className={GATE_BODY}>
                                {props.editing === gate.key
                                    ? renderSetupGatesCardEdit(gate, props)
                                    : renderSetupGatesCardEvidence(gate, props)}
                            </div>
                        </ListRow>
                    </div>
                </Fragment>
            ))}
        </List>
        <Divider semantics="presentation" />
        <div className={SECTION}>
            <div className={STACK}>
                <Button
                    intent="alternative"
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
    </Region>
)
