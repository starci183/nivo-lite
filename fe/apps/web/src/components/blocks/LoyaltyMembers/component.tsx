import {
    Badge,
    Button,
    EmptyNotice,
    ListBox,
    PrimaryRailLayout,
    SearchField,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { LoyaltyMemberPanel } from "@/components/composites/LoyaltyMemberPanel"
import type { LoyaltyMemberPanelProps } from "@/components/composites/LoyaltyMemberPanel"
import { BODY_CLASS_NAME, DETAIL_CLASS_NAME, FILTERS_CLASS_NAME } from "./classNames"

/** One labelled option of a select. */
interface MemberOption {
    readonly id: string
    readonly label: string
}

/** Copy, rows and state the connected member list supplies. */
export interface LoyaltyMembersBaseProps {
    readonly props: {
        readonly title: string
        readonly countLabel: string
        readonly search: { readonly label: string; readonly placeholder: string; readonly value: string }
        readonly tier: {
            readonly label: string
            readonly value: string
            readonly options: ReadonlyArray<MemberOption>
        }
        readonly sort: {
            readonly label: string
            readonly value: string
            readonly options: ReadonlyArray<MemberOption>
        }
        readonly rows: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly description: string
            readonly tier?: { readonly name: string; readonly tone: BadgeTone }
        }>
        readonly empty?: { readonly title: string; readonly body: string }
        readonly selectedId: string | null
        readonly showMoreLabel?: string
        readonly detailId: string
        readonly panel: Omit<LoyaltyMemberPanelProps, "onClose">
        readonly detailEmpty: { readonly title: string; readonly body: string }
    }
    readonly on: {
        readonly search: (value: string) => void
        readonly setTier: (value: string | null) => void
        readonly setSort: (value: string | null) => void
        readonly select: (id: string | null) => void
        readonly showMore: () => void
    }
}

/** Draws the member list with search, tier filter and sort, and the detail beside it (desktop) or below it (phone). */
export const LoyaltyMembersBase = (props: LoyaltyMembersBaseProps) => (
    <PrimaryRailLayout
        primary={
            <SurfaceCard
                label={props.props.title}
                headingLevel={2}
                labelEnd={
                    <Text size="xs" tone="muted" live="polite">
                        {props.props.countLabel}
                    </Text>
                }
            >
                <div className={BODY_CLASS_NAME}>
                    <div className={FILTERS_CLASS_NAME}>
                        <SearchField
                            label={props.props.search.label}
                            placeholder={props.props.search.placeholder}
                            variant="secondary"
                            value={props.props.search.value}
                            onValueChange={props.on.search}
                            onClear={() => props.on.search("")}
                        />
                        <Select
                            label={props.props.tier.label}
                            options={[...props.props.tier.options]}
                            variant="secondary"
                            value={props.props.tier.value}
                            onValueChange={props.on.setTier}
                        />
                        <Select
                            label={props.props.sort.label}
                            options={[...props.props.sort.options]}
                            variant="secondary"
                            value={props.props.sort.value}
                            onValueChange={props.on.setSort}
                        />
                    </div>
                    {props.props.empty === undefined ? (
                        <ListBox
                            label={props.props.title}
                            items={props.props.rows.map((row) => ({
                                id: row.id,
                                label: row.label,
                                description: row.description,
                                ...(row.tier === undefined
                                    ? {}
                                    : { trailing: <Badge tone={row.tier.tone}>{row.tier.name}</Badge> }),
                            }))}
                            selectionMode="single"
                            selectedIds={props.props.selectedId === null ? [] : [props.props.selectedId]}
                            onSelectionChange={(ids) => props.on.select(ids[0] ?? null)}
                        />
                    ) : (
                        <EmptyNotice message={props.props.empty.title} description={props.props.empty.body} />
                    )}
                    {props.props.showMoreLabel === undefined ? null : (
                        <div>
                            <Button variant="outline" onPress={props.on.showMore}>
                                {props.props.showMoreLabel}
                            </Button>
                        </div>
                    )}
                </div>
            </SurfaceCard>
        }
        rail={
            <div id={props.props.detailId} className={DETAIL_CLASS_NAME}>
                {props.props.selectedId === null ? (
                    <SurfaceCard ariaLabel={props.props.detailEmpty.title}>
                        <EmptyNotice
                            message={props.props.detailEmpty.title}
                            description={props.props.detailEmpty.body}
                        />
                    </SurfaceCard>
                ) : (
                    <LoyaltyMemberPanel {...props.props.panel} onClose={() => props.on.select(null)} />
                )}
            </div>
        }
        railWidth="wide"
        align="start"
    />
)
