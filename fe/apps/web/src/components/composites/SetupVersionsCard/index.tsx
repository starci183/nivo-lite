import { Badge, EmptyNotice, Heading, List, ListRow, Region } from "@starci/grammar/common"

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
    readonly isSkeleton: boolean
}

/** The immutable versions applied so far, the one in use marked. */
export const SetupVersionsCard = (props: SetupVersionsCardProps) => (
    <Region label={props.title}>
        <Heading level={2}>{props.title}</Heading>
        <List label={props.title}>
            {props.versions.map((version) => (
                <ListRow
                    key={version.id}
                    isSkeleton={props.isSkeleton}
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
            ))}
        </List>
        {props.versions.length === 0 ? <EmptyNotice message={props.emptyText} /> : null}
    </Region>
)
