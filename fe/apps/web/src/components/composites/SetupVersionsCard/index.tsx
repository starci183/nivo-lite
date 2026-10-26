import { Badge, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"

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
    <SurfaceListCard
        label={props.title}
        headingLevel={2}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyText} />}
    >
        {props.versions.length === 0
            ? null
            : props.versions.map((version) => (
                  <ListRow
                      key={version.id}
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
    </SurfaceListCard>
)
