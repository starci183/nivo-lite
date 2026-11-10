import { Badge, Button, Text } from "@starci/grammar/common"
import { WizardGuideView } from "@/components/composites/WizardGuideView"
import type { MoneyGuideView, MoneyWizardCopy } from "@/modules/types"
import { moneyFollowClassNames as classNames } from "./classNames"

/** The resolved setup guide, provider destination and notes. */
interface MoneyFollowStepProps extends MoneyGuideView {
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly text: Pick<MoneyWizardCopy, "openProvider" | "envBadge">
    readonly onEdit: (token: string, value: string) => void
    readonly onPaste: (field: string, value: string) => void
}

/** Draws the same provider destination, test badge, editable guide and saved-key note. */
export const MoneyFollowStep = (props: MoneyFollowStepProps) => (
    <>
        <div className={classNames.buttons}>
            {props.providerHref === null ? null : (
                <Button endArrow
                    intent="neutral"
                    href={props.providerHref}
                    target="_blank"
                    rel="noreferrer"
                    isLoading={props.isLoading}
                >
                    {props.text.openProvider}
                </Button>
            )}
            {props.isTest ? (
                <Badge tone="neutral" isLoading={props.isLoading}>
                    {props.text.envBadge}
                </Badge>
            ) : null}
        </div>
        <WizardGuideView
            screens={props.screens}
            copy={props.copy}
            isDisabled={props.isPending}
            onEdit={props.onEdit}
            onPaste={props.onPaste}
            isLoading={props.isLoading}
        />
        {props.keysNote === null ? null : (
            <Text size="xs" tone="muted">
                {props.keysNote}
            </Text>
        )}
    </>
)
