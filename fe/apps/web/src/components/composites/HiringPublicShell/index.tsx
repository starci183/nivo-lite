import type { ReactNode } from "react"
import { Text, WorkspaceShell } from "@starci/grammar/common"
import { COLUMN_CLASS_NAME, FOOT_CLASS_NAME } from "./classNames"

/** The words of a public hiring page and what it holds. */
interface HiringPublicShellProps {
    readonly label: string
    /** The foot line under the page; null when the content draws its own. */
    readonly foot: string | null
    /** The routed page: it draws its own `Page`. */
    readonly children: ReactNode
}

/** The frame of the pages a candidate opens without signing in: a flowing, stretched shell around the page, with the foot line under it. */
export const HiringPublicShell = (props: HiringPublicShellProps) => (
    <WorkspaceShell
        viewport="flow"
        align="stretch"
        primaryLabel={props.label}
        primary={
            <div className={COLUMN_CLASS_NAME}>
                {props.children}
                {props.foot === null ? null : (
                    <div className={FOOT_CLASS_NAME}>
                        <Text size="xs">{props.foot}</Text>
                    </div>
                )}
            </div>
        }
    />
)
