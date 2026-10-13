import { Badge, EmptyNotice, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import { COPY, ROW } from "./classNames"

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
                  <ListItem key={version.id} className={ROW}>
                      <div className={COPY}>
                          <Text weight="semibold" size="sm">
                              {version.line}
                          </Text>
                          <Text size="xs" tone="muted">
                              {version.detail}
                          </Text>
                      </div>
                      {version.isActive ? (
                          <Badge isDot tone="success">
                              {props.inUseLabel}
                          </Badge>
                      ) : null}
                  </ListItem>
              ))}
    </SurfaceListCard>
)
