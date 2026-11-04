import type { useTranslations } from "next-intl"
import type { OwnerGroupView } from "@/modules/types"

/** What the owner of a row is called: the role of a person, or the agent and its handle. */
export const ownerRoleOf = (
    t: ReturnType<typeof useTranslations<"responsibilities">>,
    group: OwnerGroupView,
): string => {
    if (group.kind === "human") return t("ownerHuman")
    return group.handle === null ? t("ownerAgent") : t("ownerAgentHandle", { handle: group.handle })
}
