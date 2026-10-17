import { useState } from "react"
import { Badge, Button, IconTile, ListBox, NavLandmark, Region, SearchField, Text } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { nivoIconSource } from "@/components/leaves/Icon"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { OfficeChatRowView, OfficeConversationsProps } from "@/modules/types"
import {
    BODY_CLASS_NAME,
    CAPTION_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    SEARCH_CLASS_NAME,
    SECTION_CLASS_NAME,
    TRAILING_CLASS_NAME,
} from "./classNames"

const contains = (value: string, query: string): boolean => value.toLowerCase().includes(query.toLowerCase())

const SELECTED_GROUP = ["group"]

const rowsOf = (rows: ReadonlyArray<OfficeChatRowView>) =>
    rows.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        leading: <OfficeAvatar avatar={row.avatar} />,
        trailing:
            row.time === null ? undefined : (
                <Text size="xs" tone="muted">
                    {row.time}
                </Text>
            ),
    }))

/** The left column: the Office group chat, each agent and the recent customers, with search. */
export const OfficeConversations = (props: OfficeConversationsProps) => {
    const { list, text, isLoading } = props.props
    const [query, setQuery] = useState("")
    const q = query.trim()
    const showGroup = q === "" || contains(list.groupLabel, q)
    const agents = list.agents.filter((row) => q === "" || contains(row.label, q))
    const customers = list.customers.filter((row) => q === "" || contains(row.label, q))
    const isEmpty = !showGroup && agents.length === 0 && customers.length === 0

    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <div className={HEAD_TEXT_CLASS_NAME}>
                    <Text weight="semibold">{text("listTitle")}</Text>
                </div>
            </div>
            <div className={SEARCH_CLASS_NAME}>
                <SearchField
                    label={text("searchLabel")}
                    isLabelHidden
                    placeholder={text("searchPlaceholder")}
                    clearLabel={text("clearSearch")}
                    value={query}
                    onValueChange={setQuery}
                    onClear={() => setQuery("")}
                />
            </div>
            <NavLandmark label={text("listLabel")} layout="scrolling" className={BODY_CLASS_NAME}>
                {isEmpty ? (
                    <Text size="sm" tone="muted">
                        {text("noMatches", { q })}
                    </Text>
                ) : null}
                {showGroup ? renderOfficeConversationsGroups(text, props, isLoading, list) : null}
                {agents.length > 0 ? (
                    <Region label={text("sectionAgents")} className={SECTION_CLASS_NAME}>
                        <div className={CAPTION_CLASS_NAME}>
                            <Text size="xs" tone="muted" weight="semibold">
                                {text("sectionAgents")}
                            </Text>
                        </div>
                        <ListBox
                            label={text("sectionAgents")}
                            selectionMode="none"
                            onAction={props.on.openAgent}
                            items={rowsOf(agents)}
                        />
                    </Region>
                ) : null}
                {customers.length > 0 ? (
                    <Region label={text("sectionCustomers")} className={SECTION_CLASS_NAME}>
                        <div className={CAPTION_CLASS_NAME}>
                            <Text size="xs" tone="muted" weight="semibold">
                                {text("sectionCustomers")}
                            </Text>
                            <Button variant="ghost" size="sm" href={CONSOLE_ROUTES.leads}>
                                {text("allCustomers")}
                            </Button>
                        </div>
                        <ListBox
                            label={text("sectionCustomers")}
                            selectionMode="none"
                            onAction={props.on.openCustomer}
                            items={rowsOf(customers)}
                        />
                    </Region>
                ) : null}
            </NavLandmark>
        </>
    )
}

/** Renders the OfficeConversations groups section. */
const renderOfficeConversationsGroups = (
    text: NonNullable<OfficeConversationsProps["props"]["text"]>,
    props: OfficeConversationsProps,
    isLoading: NonNullable<OfficeConversationsProps["props"]["isLoading"]>,
    list: NonNullable<OfficeConversationsProps["props"]["list"]>,
) => (
    <Region label={text("sectionGroups")} className={SECTION_CLASS_NAME}>
        <div className={CAPTION_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="semibold">
                {text("sectionGroups")}
            </Text>
        </div>
        <ListBox
            label={text("sectionGroups")}
            selectionMode="single"
            selectedIds={SELECTED_GROUP}
            onSelectionChange={props.on.openGroup}
            isLoading={isLoading}
            loadingRows={1}
            items={[
                {
                    id: "group",
                    label: list.groupLabel,
                    description: list.groupPreview,
                    leading: <IconTile source={nivoIconSource("community", "leading")} tone="neutral" size="sm" />,
                    trailing: (
                        <div className={TRAILING_CLASS_NAME}>
                            {list.groupTime === null ? null : (
                                <Text size="xs" tone="muted">
                                    {list.groupTime}
                                </Text>
                            )}
                            {list.pendingCount > 0 ? <Badge tone="accent">{list.pendingCount}</Badge> : null}
                        </div>
                    ),
                },
            ]}
        />
    </Region>
)
