"use client"

import { useBrainCritiqueTodo, useBrainInbox, useBrainPageHeader, useInboxCopy } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainTodoBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page hands the inbox: the header without its tabs. */
interface BrainTodoProps {
    readonly header: BrainPageHeading
    /** What the address asks of the fact drawer. */
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/**
 * The connected to-do tab: one inbox of the facts waiting (the conflicts compared one by one, the fresh facts ticked together), the
 * customer questions without an answer and the public texts waiting. Owners and managers decide; everyone reads.
 */
export const BrainTodo = (props: BrainTodoProps) => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const header = useBrainPageHeader("todo", props.header)
    const inbox = useBrainInbox({ fact: props.fact, edit: props.edit, answer: props.answer })
    const critique = useBrainCritiqueTodo()
    const copy = useInboxCopy({ progress: inbox.view.progress, isNarrowed: inbox.view.trust === "high" })
    return (
        <BrainTodoBase
            props={{ header: header.props, copy, inbox: inbox.view, critique }}
            on={{
                selectTab: header.on.selectTab,
                ...inbox.on,
                ...inbox.pick.on,
                openSources: () => router.push(workspaceHref(workspaceId, brainTabHref("sources"))),
                open: inbox.detail.on.open,
                closeDetail: inbox.detail.on.close,
                edit: inbox.detail.on.edit,
                approve: inbox.detail.on.approve,
                reject: inbox.detail.on.reject,
                menu: inbox.detail.on.menu,
                confirmRetire: inbox.detail.on.confirmRetire,
                cancelRetire: inbox.detail.on.cancelRetire,
                compare: inbox.conflict.on.open,
                closeConflict: inbox.conflict.on.close,
                choose: inbox.conflict.on.choose,
                confirmChoice: inbox.conflict.on.confirm,
            }}
        />
    )
}
