import { Badge, Button, Disclosure, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { DossierStaticRows } from "@/components/leaves/DossierStaticRows"
import type { FindingAction, FindingRowView } from "@/hooks/brain"
import { ACTIONS_CLASS_NAME, DETAIL_CLASS_NAME, EVIDENCE_CLASS_NAME, SOURCES_CLASS_NAME } from "./classNames"

export type { FindingAction, FindingRowView } from "@/hooks/brain"

/** What the rows say and call. */
interface DossierFindingRowsProps {
    readonly label: string
    readonly rows: ReadonlyArray<FindingRowView>
    readonly isSkeleton: boolean
    readonly onAction: (findingId: string, action: FindingAction) => void
}

/** The evidence of a finding as static rows, with a link to each document it comes from. */
const Evidence = (props: Pick<FindingRowView, "id" | "evidenceTitle" | "evidence" | "sources">) => (
    <Disclosure title={props.evidenceTitle} headingLevel={4}>
        <div className={EVIDENCE_CLASS_NAME}>
            <DossierStaticRows label={props.evidenceTitle} items={props.evidence} />
            <div className={SOURCES_CLASS_NAME}>
                {props.sources.map((source) => (
                    <TextAction key={source.id} href={source.href}>
                        {source.label}
                    </TextAction>
                ))}
            </div>
        </div>
    </Disclosure>
)

/** One row and what its actions call. */
interface RowDetailProps {
    readonly row: FindingRowView
    readonly onAction: DossierFindingRowsProps["onAction"]
}

/** The meta line, the evidence and the actions that belong to one row. */
const RowDetail = (props: RowDetailProps) => (
    <div className={DETAIL_CLASS_NAME}>
        {props.row.meta === null ? null : <Text tone="muted">{props.row.meta}</Text>}
        {props.row.evidence.length === 0 ? null : <Evidence {...props.row} />}
        {props.row.actions.length === 0 ? null : (
            <div className={ACTIONS_CLASS_NAME}>
                {props.row.actions.map((action) =>
                    action.href === null ? (
                        <Button
                            key={action.id}
                            size="sm"
                            intent="neutral"
                            onPress={() => props.onAction(props.row.id, action.id)}
                        >
                            {action.label}
                        </Button>
                    ) : (
                        <Button key={action.id} size="sm" intent="neutral" href={action.href}>
                            {action.label}
                        </Button>
                    ),
                )}
            </div>
        )}
    </div>
)

/**
 * The findings of the dossier review as rows of one list: severity, kind and AI badges, the title (a link where the row leads
 * to its dossier), the detail as the one description line, then the owner, the evidence and the actions under it. Shared by the
 * pane of one dossier and the list of what needs doing.
 */
export const DossierFindingRows = (props: DossierFindingRowsProps) => (
    <SurfaceListCard ariaLabel={props.label} isLoading={props.isSkeleton}>
        {props.isSkeleton
            ? null
            : props.rows.map((row) => (
                  <ListRow
                      key={row.id}
                      title={
                          row.titleHref === null ? row.title : <TextAction href={row.titleHref}>{row.title}</TextAction>
                      }
                      description={row.detail}
                      state={row.isFocused ? "informative" : "neutral"}
                      badges={
                          <>
                              {row.badges.map((badge) => (
                                  <Badge key={badge.id} tone={badge.tone}>
                                      {badge.label}
                                  </Badge>
                              ))}
                          </>
                      }
                  >
                      <RowDetail row={row} onAction={props.onAction} />
                  </ListRow>
              ))}
    </SurfaceListCard>
)
