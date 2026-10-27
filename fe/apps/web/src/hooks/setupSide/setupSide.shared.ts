import type { useSetupRequirements } from "@/hooks/setupRequirements"
import type { SetupSideNotice } from "@/modules/types"
import type { useTranslations } from "next-intl"

/** The notice that explains which requirements block setup. */
export const setupRequirementsNoticeOf = (
    t: ReturnType<typeof useTranslations<"moduleSetup">>,
    unmet: ReturnType<typeof useSetupRequirements>,
): SetupSideNotice | null => {
    const first = unmet[0]
    return first === undefined
        ? null
        : {
              title: t("requirementsTitle"),
              body: `${t("requirementsBody")} ${unmet
                  .map((item) => (item.messageKey === "" ? item.key : t(item.messageKey)))
                  .join("; ")}.`,
              actionLabel: t("requirementsFix"),
              href: first.href,
          }
}
