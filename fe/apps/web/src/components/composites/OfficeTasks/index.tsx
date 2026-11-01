import { useState } from "react"
import {
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    IconTile,
    ListItem,
    Select,
    Stack,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeTasksProps } from "@/modules/types"
import { FILTER_CLASS_NAME, ROW_MAIN_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

const ALL = "all"

const STATUS_KEYS = { open: "statusOpen", waiting_approval: "statusWaiting", done: "statusDone" } as const

const STATUS_TONES = { open: "accent", waiting_approval: "warning", done: "success" } as const

const STATUSES = ["open", "waiting_approval", "done"] as const

/** Team tasks: owner and status filters over every responsibility, each row linking to its customer. */
export const OfficeTasks = (props: OfficeTasksProps) => {
    const { tasks, text } = props.props
    const [owner, setOwner] = useState(ALL)
    const [status, setStatus] = useState(ALL)
    const ownerOptions = [
        { id: ALL, label: text("allOwners") },
        ...[...new Set(tasks.map((task) => task.owner))].map((name) => ({ id: name, label: name })),
    ]
    const statusOptions = [
        { id: ALL, label: text("allStatuses") },
        ...STATUSES.map((key) => ({ id: key, label: text(STATUS_KEYS[key]) })),
    ]
    const visible = tasks.filter(
        (task) => (owner === ALL || task.owner === owner) && (status === ALL || task.status === status),
    )
    const clear = () => {
        setOwner(ALL)
        setStatus(ALL)
    }

    return (
        <div className={STACK_CLASS_NAME}>
            <Stack gap="section">
                <Cluster gap="row" align="end">
                    <div className={FILTER_CLASS_NAME}>
                        <Select
                            label={text("filterOwner")}
                            options={ownerOptions}
                            value={owner}
                            onValueChange={(value) => setOwner(value ?? ALL)}
                        />
                    </div>
                    <div className={FILTER_CLASS_NAME}>
                        <Select
                            label={text("filterStatus")}
                            options={statusOptions}
                            value={status}
                            onValueChange={(value) => setStatus(value ?? ALL)}
                        />
                    </div>
                    {owner !== ALL || status !== ALL ? (
                        <Button intent="neutral" onPress={clear}>
                            {text("clearFilters")}
                        </Button>
                    ) : null}
                </Cluster>
                {renderOfficeTasksVisibleTasks(text, visible, tasks, props, clear)}
            </Stack>
        </div>
    )
}

/** Renders the OfficeTasks visible tasks section. */
const renderOfficeTasksVisibleTasks = (
    text: NonNullable<OfficeTasksProps["props"]["text"]>,
    visible: NonNullable<OfficeTasksProps["props"]["tasks"]>,
    tasks: NonNullable<OfficeTasksProps["props"]["tasks"]>,
    props: OfficeTasksProps,
    clear: () => void,
) => (
    <SurfaceListCard
        label={text("tasksLabel")}
        headingLevel={2}
        fact={text("tasksFact", { shown: visible.length, total: tasks.length })}
        empty={
            tasks.length === 0 ? (
                <EmptyNotice
                    message={text("noTasks")}
                    description={text("noTasksHint")}
                    actionLabel={text("openLeads")}
                    actionVariant="secondary"
                    onAction={props.on.openLeads}
                />
            ) : (
                <EmptyNotice
                    message={text("noTasksMatch")}
                    description={text("noTasksMatchHint")}
                    actionLabel={text("clearFilters")}
                    actionVariant="secondary"
                    onAction={clear}
                />
            )
        }
    >
        {visible.map((task) => (
            <ListItem key={task.id}>
                <Cluster gap="row">
                    <IconTile source={nivoIconSource("review", "leading")} tone="accent" size="md" />
                    <div className={ROW_MAIN_CLASS_NAME}>
                        <Stack gap="identity">
                            <Cluster gap="inline">
                                <Text weight="semibold">{task.title}</Text>
                                <Badge tone={STATUS_TONES[task.status]} isDot>
                                    {text(STATUS_KEYS[task.status])}
                                </Badge>
                            </Cluster>
                            <Text size="sm" tone="muted" overflow="clamp-2">
                                {task.nextAction}
                            </Text>
                            <Text size="sm" tone="muted">
                                {task.meta}
                            </Text>
                        </Stack>
                    </div>
                    <Button intent="neutral" size="sm" href={task.leadHref}>
                        {text("openArrow")}
                    </Button>
                </Cluster>
            </ListItem>
        ))}
    </SurfaceListCard>
)
