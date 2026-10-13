import { Alert } from "@starci/grammar/common"
import type { DashboardRegion } from "@/modules/types"

/** The translator and the timestamp format of the regions, resolved by the connected owner. */
export interface WorkbenchRegionsView {
    readonly t: (key: string, values?: Record<string, string | number>) => string
    readonly when: (iso: string | null | undefined) => string
}

/** What one region needs besides its own data. */
export interface RegionProps<T> {
    readonly region: DashboardRegion<T> | undefined
    readonly isLoading: boolean
    readonly view: WorkbenchRegionsView
    readonly retry: () => void
}

/** What a region that could not be read shows. */
interface RegionFailedProps {
    readonly label: string
    readonly view: WorkbenchRegionsView
    readonly retry: () => void
}

/** A region that could not be read fails in place: one negative Alert with a retry, the rest of the page stays. */
export const RegionFailed = (props: RegionFailedProps) => (
    <Alert
        tone="negative"
        title={props.view.t("regionFailed")}
        description={`${props.label}. ${props.view.t("regionFailedText")}`}
        action={{ label: props.view.t("retry"), onAction: props.retry }}
    />
)
