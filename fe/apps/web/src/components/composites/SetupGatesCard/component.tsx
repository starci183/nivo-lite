import { Text } from "@starci/grammar/common"
import { EVIDENCE } from "./classNames"

type SetupGatesCardEvidenceProps = {
    readonly hint: string
    readonly evidence: string
    readonly isWaiting: boolean
}

/** A gate's evidence owns its hint while waiting or before evidence is supplied. */
export const SetupGatesCardEvidence = (props: SetupGatesCardEvidenceProps) => {
    if (props.isWaiting || props.evidence === "") {
        return (
            <Text size="sm" tone="muted">
                {props.hint}
            </Text>
        )
    }

    return (
        <div className={EVIDENCE}>
            <Text size="sm">{props.evidence}</Text>
        </div>
    )
}
