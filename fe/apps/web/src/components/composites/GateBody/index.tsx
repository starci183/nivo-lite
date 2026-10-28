import type { ReactNode } from "react"
import { SurfaceListCard } from "@starci/grammar/common"

/** What a read gate draws while its read waits and once it is ready. */
interface GateBodyProps {
    readonly isSkeleton: boolean
    /** The name of the panel behind the gate, the label of its skeleton card while the read waits. */
    readonly name: string
    readonly content: ReactNode
}

/** The blocks behind a read gate once ready; while the read waits, the skeleton of their panel. */
export const GateBody = (props: GateBodyProps) => (
    <>
        {props.isSkeleton ? <SurfaceListCard ariaLabel={props.name} isLoading /> : null}
        {props.isSkeleton ? null : props.content}
    </>
)
