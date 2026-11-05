import type { useFormatter, useTranslations } from "next-intl"
import type { OwnerGroupView, ResponsibilityOpenedView } from "@/modules/types"

/** What the owner of a row is called: the role of a person, or the agent and its handle. */
export const ownerRoleOf = (
    t: ReturnType<typeof useTranslations<"responsibilities">>,
    group: OwnerGroupView,
): string => {
    if (group.kind === "human") return t("ownerHuman")
    return group.handle === null ? t("ownerAgent") : t("ownerAgentHandle", { handle: group.handle })
}

/** What the groups of the list are worded with. */
interface GroupWords {
    readonly t: ReturnType<typeof useTranslations<"responsibilities">>
    readonly format: ReturnType<typeof useFormatter>
    readonly pictureOf: (agent: { readonly handle: string | null; readonly name: string }) => string | null
}

/** The owner groups as the list draws them: a caption with the owner, the role and the count, and each row with its owner's words. */
export const openedGroupsOf = (
    words: GroupWords,
    groups: ReadonlyArray<OwnerGroupView>,
): ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly rows: ReadonlyArray<ResponsibilityOpenedView>
}> =>
    groups.map((group) => ({
        id: group.key,
        label: `${group.name} · ${ownerRoleOf(words.t, group)} · ${words.t(group.rows.length === 1 ? "countOne" : "countMany", { n: group.rows.length })}`,
        rows: group.rows.map((row) => ({
            row,
            avatarUrl: group.kind === "agent" ? words.pictureOf({ handle: group.handle, name: group.name }) : null,
            ownerRole: ownerRoleOf(words.t, group),
            dueDate:
                row.dueAt === null
                    ? null
                    : words.format.dateTime(new Date(row.dueAt), { day: "2-digit", month: "2-digit", year: "numeric" }),
            canDraft: row.status === "open",
        })),
    }))
