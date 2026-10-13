import type { ReactNode } from "react"
import { PageContainer, Text, WorkspaceShell } from "@starci/grammar/common"
import { COLUMN_CLASS_NAME, FOOT_CLASS_NAME } from "./classNames"

/** The words of a public hiring page and what it holds. */
interface HiringPublicShellProps {
    readonly label: string
    /** The foot line; null when the content draws its own. */
    readonly foot: string | null
    readonly children: ReactNode
}

/** The frame of the pages a candidate opens without signing in: a reading column in the shell, with the foot line. */
export const HiringPublicShell = (props: HiringPublicShellProps) => (
    <WorkspaceShell
        align="stretch"
        primaryLabel={props.label}
        primary={
            <PageContainer measure="reading">
                <div className={COLUMN_CLASS_NAME}>
                    {props.children}
                    {props.foot === null ? null : (
                        <div className={FOOT_CLASS_NAME}>
                            <Text size="xs">{props.foot}</Text>
                        </div>
                    )}
                </div>
            </PageContainer>
        }
    />
)
