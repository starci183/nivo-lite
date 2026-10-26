import { Badge, EmptyNotice, Heading, List, ListRow, Region } from "@starci/grammar/common"
import { HEAD, ROW } from "./classNames"

/** The applied versions of the setup in the reader language. */
type SetupVersionsCardProps = {
    readonly title: string
    readonly emptyText: string
    readonly inUseLabel: string
    readonly versions: ReadonlyArray<{
        readonly id: string
        readonly line: string
        readonly detail: string
        readonly isActive: boolean
    }>
    readonly isLoading: boolean
}

/** The immutable versions applied so far, the one in use marked. */
export const SetupVersionsCard = (props: SetupVersionsCardProps) => (
    <Region label={props.title}>
        <div className={HEAD}>
            <Heading level={2}>{props.title}</Heading>
        </div>
        <List label={props.title}>
            {props.versions.map((version) => (
                <div key={version.id} className={ROW}>
                    <ListRow
                        isSkeleton={props.isLoading}
                        title={version.line}
                        description={version.detail}
                        badges={
                            version.isActive ? (
                                <Badge isDot tone="success">
                                    {props.inUseLabel}
                                </Badge>
                            ) : undefined
                        }
                    />
                </div>
            ))}
        </List>
        {props.versions.length === 0 ? (
            <div className={ROW}>
                <EmptyNotice message={props.emptyText} />
            </div>
        ) : null}
    </Region>
)
