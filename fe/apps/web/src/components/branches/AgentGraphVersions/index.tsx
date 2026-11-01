import { Badge, Button, EmptyNotice, List, ListRow, SectionHeader, Switch } from "@starci/grammar/common"
import type { AgentGraphVersionsView } from "@/modules/types"

/** The history of the graph and the command that goes back to a saved version. */
type AgentGraphVersionsProps = {
    readonly view: AgentGraphVersionsView
    readonly isSkeleton: boolean
    readonly onRestore: (versionId: string) => void
    readonly onMode: (value: string) => void
}

/** Every save is a version nobody can change: who changed what, from which rule, and how many runs it decided. */
export const AgentGraphVersions = (props: AgentGraphVersionsProps) => (
    <>
        <SectionHeader level={3} title={props.view.title} description={props.view.hint} isSkeleton={props.isSkeleton} />
        <Switch
            label={props.view.mode.label}
            description={props.view.mode.hint}
            isSelected={props.view.mode.isEnforced}
            isDisabled={props.view.mode.isDisabled}
            isSkeleton={props.isSkeleton}
            onSelectedChange={(isEnforced) => props.onMode(isEnforced ? "enforced" : "shadow")}
        />
        <List label={props.view.title}>
            {props.view.items.map((item) => (
                <ListRow
                    key={item.id}
                    isSkeleton={props.isSkeleton}
                    title={item.title}
                    description={`${item.note} · ${item.byLine}`}
                    badges={
                        item.badge === null ? undefined : (
                            <Badge isDot tone={item.badge.tone}>
                                {item.badge.text}
                            </Badge>
                        )
                    }
                    actions={
                        item.canRestore ? (
                            <Button intent="neutral" size="sm" onPress={() => props.onRestore(item.id)}>
                                {item.restoreLabel}
                            </Button>
                        ) : undefined
                    }
                />
            ))}
        </List>
        {props.view.items.length === 0 ? <EmptyNotice message={props.view.title} /> : null}
    </>
)
