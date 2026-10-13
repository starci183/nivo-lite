import { getTranslations } from "next-intl/server"
import { ShiftsWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the slot. */
interface ShiftsWorkbenchPageProps {
    /** `?tab=` from the route (week, requests, setup, quick, mine); anything else opens the first tab. */
    readonly tab?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Shifts workbench slot: a server shell that words the tabs and ribbon terms, then draws the frame around the connected tab blocks. */
export const ShiftsWorkbenchPage = async (props: ShiftsWorkbenchPageProps) => {
    const t = await getTranslations("shifts")
    const tf = await getTranslations("workbenchFigures")
    return (
        <ShiftsWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                initialTab: props.tab ?? null,
                tabs: {
                    week: t("tabWeek"),
                    requests: t("tabRequests"),
                    setup: t("tabSetup"),
                    quick: t("tabQuick"),
                    mine: t("tabMine"),
                },
                terms: [tf("shWeek"), tf("shGaps"), tf("shLeave"), tf("shHours")],
            }}
        />
    )
}
