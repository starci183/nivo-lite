import { Button, Cluster, EmptyNotice, Select, Section, type ListRowData, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeTasksProps } from "@/modules/types"
import { FILTER_CLASS_NAME } from "./classNames"

const ALL = "all"

const STATUS_TONES = { open: "accent", waiting_approval: "warning", done: "success" } as const

/** Team tasks: owner and status filters over every responsibility, each row linking to its customer. */
export const OfficeTasks = (props: OfficeTasksProps) => {
    const { tasks, copy, owner, status, ownerOptions, statusOptions } = props.props
    const clear = props.on.clear

    return (
        <Section
            kind="list"
            title={copy.title}
            headingLevel={2}
            meta={props.props.meta}
            filter={
                <TaskFilters
                    copy={copy}
                    owner={owner}
                    status={status}
                    ownerOptions={ownerOptions}
                    statusOptions={statusOptions}
                    onOwner={props.on.owner}
                    onStatus={props.on.status}
                    clear={clear}
                />
            }
            empty={
                !props.props.hasTasks ? (
                    <EmptyNotice message={copy.noTasks} description={copy.noTasksHint} />
                ) : (
                    <EmptyNotice
                        message={copy.noTasksMatch}
                        description={copy.noTasksMatchHint}
                        actionLabel={copy.clearFilters}
                        onAction={clear}
                    />
                )
            }
            items={tasks.map((task): ListRowData => ({
                id: task.id,
                title: task.title,
                description: task.nextAction,
                leading: { icon: nivoIconSource("review", "leading") },
                badges: [{ label: task.statusLabel, tone: STATUS_TONES[task.status], isDot: true }],
                detail: (
                    <Text size="sm" tone="muted">
                        {task.meta}
                    </Text>
                ),
            }))}
        />
    )
}

interface TaskFiltersProps {
    readonly copy: OfficeTasksProps["props"]["copy"]
    readonly owner: string
    readonly status: string
    readonly ownerOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly statusOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onOwner: (value: string) => void
    readonly onStatus: (value: string) => void
    readonly clear: () => void
}
/** Independent filters retain their selected values and clear command. */
const TaskFilters = (props: TaskFiltersProps) => {
    const { copy, owner, status, ownerOptions, statusOptions, clear } = props
    const setOwner = props.onOwner
    const setStatus = props.onStatus
    return (
        <Cluster gap="row" align="end">
            <div className={FILTER_CLASS_NAME}>
                <Select
                    label={copy.filterOwner}
                    options={ownerOptions}
                    value={owner}
                    onValueChange={(value) => setOwner(value ?? ALL)}
                />
            </div>
            <div className={FILTER_CLASS_NAME}>
                <Select
                    label={copy.filterStatus}
                    options={statusOptions}
                    value={status}
                    onValueChange={(value) => setStatus(value ?? ALL)}
                />
            </div>
            {owner !== ALL || status !== ALL ? (
                <Button intent="neutral" onPress={clear}>
                    {copy.clearFilters}
                </Button>
            ) : null}
        </Cluster>
    )
}
