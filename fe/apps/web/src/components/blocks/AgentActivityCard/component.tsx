import { Stack, Switch } from "@starci/grammar/common"
import { FieldBlock } from "@/components/frames/FieldBlock"

/** One setting of the activity block: its title and description, and the switch at the end of the title row. */
export interface ActivityRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly isSelected: boolean
    readonly isDisabled: boolean
    /** Why the switch cannot be turned on yet, said after the description; empty when nothing blocks. */
    readonly blocker: string
}

/** Copy and state of the activity block. */
export interface AgentActivityCardBaseProps {
    readonly props: {
        readonly rows: ReadonlyArray<ActivityRowView>
    }
    readonly on: { readonly change: (id: string, on: boolean) => void }
}

/** Draws the settings that act at once as flat fields: each a noun title with its description and a switch at the right. */
export const AgentActivityCardBase = (props: AgentActivityCardBaseProps) => (
    <Stack gap="region">
        {props.props.rows.map((row) => (
            <FieldBlock
                key={row.id}
                title={row.title}
                description={row.blocker === "" ? row.subtitle : `${row.subtitle} ${row.blocker}`}
                trailing={
                    <Switch
                        name={row.id}
                        label={row.title}
                        isLabelHidden
                        isSelected={row.isSelected}
                        isDisabled={row.isDisabled}
                        onSelectedChange={(on) => props.on.change(row.id, on)}
                    />
                }
            />
        ))}
    </Stack>
)
