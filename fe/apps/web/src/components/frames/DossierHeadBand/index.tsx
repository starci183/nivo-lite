import { Badge, Button, DropdownMenu, Icon, IconButton, IconTile } from "@starci/grammar/common"
import type { DossierFindingsPane } from "@/components/composites/DossierFindingBoard"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DossierHeadView } from "@/hooks/brain"

/** The words of the open dossier's head and body. */
export interface DossierMainCopy {
    readonly assignEntry: string
    readonly listLabel: string
    readonly back: string
    readonly moreOptions: string
    readonly openOnMap: string
    readonly findingOptions: string
    readonly emptyFindings: string
    /** The name of the "+n" filter menu; `{count}` stands for how many tabs it holds. */
    readonly filtersMore: string
}

/** What the head band over the open dossier draws. */
interface DossierHeadBandProps {
    readonly head: DossierHeadView | null
    /** The findings pane of the open dossier; null while none is open. */
    readonly findings: DossierFindingsPane | null
    readonly copy: DossierMainCopy
    readonly isWaiting: boolean
    readonly onBack: () => void
    readonly onReview: () => void
    readonly onOpenMap: () => void
    readonly onAssign: () => void
}

/** What the review command and the options menu of the head draw. */
interface HeadActionsProps {
    readonly findings: DossierFindingsPane
    readonly copy: DossierMainCopy
    readonly onReview: () => void
    readonly onOpenMap: () => void
    readonly onAssign: () => void
}

/** The commands of the open dossier's head: the review of this dossier, and the menu with the way to its place on the map. */
const HeadActions = (props: HeadActionsProps) => {
    const frame = props.findings.frame
    return (
        <>
            {frame.reviewLabel === null ? null : (
                <Button
                    intent="alternative"
                    size="sm"
                    isPending={frame.isReviewPending}
                    startContent={<Icon source={nivoIconSource("retry", "leading")} usage="leading" />}
                    onPress={props.onReview}
                >
                    {frame.reviewLabel}
                </Button>
            )}
            <DropdownMenu
                placement="bottom end"
                entries={[
                    { id: "assign", label: props.copy.assignEntry, onAction: props.onAssign },
                    { id: "map", label: props.copy.openOnMap, onAction: props.onOpenMap },
                ]}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("more", "leading")}
                        label={props.copy.moreOptions}
                    />
                }
            />
        </>
    )
}

/** The head band over the open dossier: what it is, where it stands and its commands; a phone gets the way back. */
export const DossierHeadBand = (props: DossierHeadBandProps) => {
    const { head, findings, copy } = props
    const back = { label: copy.back, onPress: props.onBack }
    if (head === null || findings === null) return <PaneHead title={copy.listLabel} headingLevel={1} back={back} />
    return (
        <PaneHead
            title={head.title}
            headingLevel={1}
            description={head.description}
            mark={<IconTile source={nivoIconSource("document", "leading")} tone="neutral" />}
            {...(head.badge === null ? {} : { status: <Badge tone={head.badge.tone}>{head.badge.label}</Badge> })}
            isLoading={props.isWaiting}
            back={back}
            actions={
                <HeadActions
                    findings={findings}
                    copy={copy}
                    onReview={props.onReview}
                    onOpenMap={props.onOpenMap}
                    onAssign={props.onAssign}
                />
            }
        />
    )
}
