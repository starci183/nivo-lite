import { Alert, Skeleton } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** How a console read stands: still on its way, failed (already localized by the back end), or done. */
export type AdminLoad = {
    /** True while the read is still on its way. */
    readonly isLoading: boolean
    /** The failure of the read; none draws the content. */
    readonly error?: string | undefined
    readonly failedTitle: string
}

/** What a console read tells the card that draws it. */
type AdminLoadStateProps = AdminLoad & {
    readonly children: ReactNode
}

/** Draws a skeleton while a console read loads, the failure when it fails, and the content once it arrived. */
export const AdminLoadState = (props: AdminLoadStateProps) => {
    if (props.error !== undefined) return <Alert tone="negative" title={props.failedTitle} description={props.error} />
    if (props.isLoading) return <Skeleton shape="text" lines={3} />
    return <>{props.children}</>
}
