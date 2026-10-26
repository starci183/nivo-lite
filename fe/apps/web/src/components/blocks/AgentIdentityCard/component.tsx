import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { AgentMark } from "../../leaves/AgentMark"
import { ACTIONS, GROW, ROW, STACK } from "./classNames"

/** Copy and state of the name card of an agent. */
export interface AgentIdentityCardBaseProps {
    readonly props: {
        readonly title: string
        readonly glyph: ModuleIconName
        readonly module: string
        readonly markLabel: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly name: string
        readonly maxLength: number
        readonly line: string
        readonly saveLabel: string
        readonly canSave: boolean
        readonly isDisabled: boolean
        readonly isPending: boolean
        readonly isLoading: boolean
    }
    readonly on: { readonly name: (value: string) => void; readonly save: () => void }
}

/** Draws the name card of an agent: its mark, the one name field and its save. */
export const AgentIdentityCardBase = (props: AgentIdentityCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <div className={ROW}>
                <AgentMark
                    glyph={nivoIconSource(props.props.glyph, "leading")}
                    module={props.props.module}
                    label={props.props.markLabel}
                    size="lg"
                />
                <div className={GROW}>
                    <Input
                        id="module-name"
                        name="name"
                        label={props.props.nameLabel}
                        hint={props.props.nameHint}
                        value={props.props.name}
                        isSkeleton={props.props.isLoading}
                        isDisabled={props.props.isDisabled}
                        onValueChange={(value) => props.on.name(value.slice(0, props.props.maxLength))}
                    />
                </div>
            </div>
            <Text size="sm" tone="muted" isSkeleton={props.props.isLoading}>
                {props.props.line}
            </Text>
            <div className={ACTIONS}>
                <Button
                    intent="neutral"
                    isSkeleton={props.props.isLoading}
                    isPending={props.props.isPending}
                    isDisabled={!props.props.canSave}
                    onPress={props.on.save}
                >
                    {props.props.saveLabel}
                </Button>
            </div>
        </div>
    </SurfaceCard>
)
