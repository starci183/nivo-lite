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
import { SetupGateBody } from "@/components/branches/SetupGateBody"
import type { SetupGatesCardProps } from "@/modules/types"
import { GATE_ROW, SECTION, STACK } from "./classNames"

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
                isSkeleton={props.isSkeleton}
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
                                <Badge isDot isSkeleton={props.isSkeleton} tone={gate.statusTone}>
                                    {gate.statusLabel}
                                </Badge>
                            }
                            actions={
                                props.editing === gate.key ? undefined : (
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
                            <SetupGateBody {...props} gate={gate} isEditing={props.editing === gate.key} />
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
                    isSkeleton={props.isSkeleton}
                    isPending={props.isApplying}
                    isDisabled={!props.canApply}
                    onPress={props.onApply}
                >
                    {props.applyLabel}
                </Button>
                <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
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
