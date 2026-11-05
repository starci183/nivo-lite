import type { LoyaltyViews, LoyaltyActions } from "../types"
import type { ReactNode } from "react"

import {
    Badge,
    Button,
    EmptyNotice,
    ListBox,
    SearchField,
    Select,
    SurfaceCard,
    Text,
    Grid,
    Stack,
} from "@starci/grammar/common"
import { MasterDetail } from "../legacy"

/** One labelled option of a select. */

/** Copy, rows and state the connected member list supplies. */
type LoyaltyMembersView = LoyaltyViews["members"]
type LoyaltyMembersActions = LoyaltyActions["members"]

/** Draws the member list with search, tier filter and sort, and the detail beside it (desktop) or below it (phone). */
export const LoyaltyMembers = (props: LoyaltyMembersProps): ReactNode => (
    <MasterDetail
        list={renderMemberList({ props })}
        detail={props.selectedId === null ? null : props.children}
        detailId={props.detailId}
        empty={props.detailEmpty}
        isLoading={props.isLoading}
    />
)

/** Inputs needed to build the title section. */
interface RenderMemberListContext {
    readonly props: LoyaltyMembersProps
}
/** Builds the title section from the current view. */
const renderMemberList = ({ props }: RenderMemberListContext) => (
    <SurfaceCard
        isLoading={props.isLoading}
        label={props.title}
        headingLevel={2}
        labelEnd={
            <Text isLoading={props.isLoading} size="xs" tone="muted" live="polite">
                {props.countLabel}
            </Text>
        }
    >
        <Stack gap="row">
            <Grid kind="form" columns={2}>
                <SearchField
                    isLoading={props.isLoading}
                    label={props.search.label}
                    placeholder={props.search.placeholder}
                    value={props.search.value}
                    onValueChange={props.on.search}
                    onClear={() => props.on.search("")}
                />
                <Select
                    isLoading={props.isLoading}
                    label={props.tier.label}
                    options={[...props.tier.options]}
                    value={props.tier.value}
                    onValueChange={props.on.setTier}
                />
                <Select
                    isLoading={props.isLoading}
                    label={props.sort.label}
                    options={[...props.sort.options]}
                    value={props.sort.value}
                    onValueChange={props.on.setSort}
                />
            </Grid>
            {props.empty === undefined ? (
                <ListBox
                    isLoading={props.isLoading}
                    label={props.title}
                    items={props.rows.map((row) => ({
                        id: row.id,
                        label: row.label,
                        description: row.description,
                        ...(row.tier === undefined
                            ? {}
                            : {
                                  trailing: (
                                      <Badge isLoading={props.isLoading} tone={row.tier.tone}>
                                          {row.tier.name}
                                      </Badge>
                                  ),
                              }),
                    }))}
                    selectionMode="single"
                    selectedIds={props.selectedId === null ? [] : [props.selectedId]}
                    onSelectionChange={(ids) => props.on.select(ids[0] ?? null)}
                />
            ) : (
                <EmptyNotice message={props.empty.title} description={props.empty.body} />
            )}
            {props.showMoreLabel === undefined ? null : (
                <div>
                    <Button isLoading={props.isLoading} intent="neutral" onPress={props.on.showMore}>
                        {props.showMoreLabel}
                    </Button>
                </div>
            )}
        </Stack>
    </SurfaceCard>
)
interface LoyaltyMembersProps extends LoyaltyMembersView {
    readonly on: LoyaltyMembersActions
    readonly isLoading: boolean
    readonly children: ReactNode
}
