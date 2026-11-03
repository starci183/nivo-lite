import type { ReactNode } from "react"
import { Alert, Dialog, Stack } from "@starci/grammar/common"

/** The words, footer and body of a hiring dialog, and the failure it reports above the body. */
interface HiringDialogShellProps {
    readonly size: "md" | "lg"
    readonly title: string
    readonly closeLabel: string
    readonly description: string
    readonly footer: ReactNode
    /** The title of the failure alert. */
    readonly errorTitle: string
    /** Why the last command failed; null while nothing has. */
    readonly error: string | null
    readonly onClose: () => void
    readonly body: ReactNode
}

/** An open hiring dialog: the failure of the last command above its body, closed by its close button or by dismissing. */
export const HiringDialogShell = (props: HiringDialogShellProps) => (
    <Dialog
        isOpen
        onOpenChange={(open) => {
            if (!open) props.onClose()
        }}
        size={props.size}
        title={props.title}
        closeLabel={props.closeLabel}
        description={props.description}
        footer={props.footer}
    >
        <Stack gap="row">
            {props.error === null ? null : <Alert tone="negative" title={props.errorTitle} description={props.error} />}
            {props.body}
        </Stack>
    </Dialog>
)
