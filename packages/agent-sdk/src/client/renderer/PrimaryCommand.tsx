"use client"

import type { ReactNode } from "react"
import { Button } from "@starci/grammar/common"
import type { ActionDefinition } from "../../block/block.types"
import type { SpecActionBinding } from "../../spec/spec.types"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import { BoundAction } from "./BoundAction"

/** What the primary command takes. */
export interface PrimaryCommandProps {
    /** The action the open view declares as its primary command. */
    readonly command: SpecActionBinding | undefined
    readonly actions: ReadonlyArray<ActionDefinition>
    readonly namespace: string
}

/**
 * The primary command of the open view, as the page's one primary button. It draws nothing when the view declares none, when the
 * action is not installed, or when the viewer lacks its permission; it runs the action with no record, and a refusal is toasted.
 */
export const PrimaryCommand = (props: PrimaryCommandProps): ReactNode => {
    const host = useWorkbenchHost()
    const action = props.actions.find((candidate) => candidate.id === props.command?.action)
    if (action === undefined) return null
    const text = host.block.text(props.namespace)
    return (
        <BoundAction action={action} namespace={props.namespace}>
            {(handle) =>
                handle.isAllowed ? (
                    <Button
                        intent="commit"
                        isPending={handle.isRunning}
                        onPress={() => {
                            handle
                                .run({ id: "" })
                                .then((outcome) => {
                                    if (!outcome.ok && outcome.message !== undefined)
                                        host.block.notify("danger", text(outcome.message))
                                })
                                .catch(() =>
                                    host.block.notify("danger", host.block.text("blocks")({ key: "renderer.crashed" })),
                                )
                        }}
                    >
                        {handle.label}
                    </Button>
                ) : null
            }
        </BoundAction>
    )
}
