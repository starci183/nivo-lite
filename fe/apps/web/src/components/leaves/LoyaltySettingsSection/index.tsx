import { SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { BODY_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** What one section of the programme settings draws. */
type LoyaltySettingsSectionProps = {
    readonly title: string
    readonly hint?: string
    readonly children: ReactNode
}

/** One titled card of the programme settings: an optional hint over the stacked fields. */
export const LoyaltySettingsSection = (props: LoyaltySettingsSectionProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={BODY_CLASS_NAME}>
            {props.hint === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.hint}
                </Text>
            )}
            <div className={FORM_CLASS_NAME}>{props.children}</div>
        </div>
    </SurfaceCard>
)
