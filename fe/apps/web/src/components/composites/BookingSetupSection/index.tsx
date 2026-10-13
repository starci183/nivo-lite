import type { ReactNode } from "react"
import { SurfaceCard, Text } from "@starci/grammar/common"
import { STACK_CLASS } from "./classNames"

/** What a setup region draws. */
type BookingSetupSectionProps = {
    readonly title: string
    readonly hint?: string
    readonly children: ReactNode
}

/** One region of the setup tab: its heading and one surface holding the forms of that region. */
export const BookingSetupSection = (props: BookingSetupSectionProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            {props.hint === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.hint}
                </Text>
            )}
            {props.children}
        </div>
    </SurfaceCard>
)
