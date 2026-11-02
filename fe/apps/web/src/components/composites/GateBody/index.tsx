import type { ReactNode } from "react"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** What a read gate draws while its read waits and once it is ready. */
interface GateBodyProps {
    readonly isLoading: boolean
    /** The name of the panel behind the gate, the label of its skeleton card while the read waits. */
    readonly name: string
    readonly content: ReactNode
}

/** The blocks behind a read gate once ready; while the read waits, the skeleton of their panel. */
export const GateBody = (props: GateBodyProps) => (
    <>
        {props.isLoading ? (
            <SurfaceCard
                kind="list"
                ariaLabel={props.name}
                isLoading
                empty={<EmptyNotice message={props.name} />}
                items={[]}
            />
        ) : null}
        {props.isLoading ? null : props.content}
    </>
)
