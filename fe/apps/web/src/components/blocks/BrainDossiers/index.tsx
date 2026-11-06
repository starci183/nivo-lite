"use client"

import { useState } from "react"
import {
    useBrainDossierDesk,
    useBrainMapView,
    useBrainPageHeader,
    useChecklistImport,
    useDossierCopy,
    useDossierFindingsView,
    useDossierRemedyDrawer,
    waitingFindingsOf,
} from "@/hooks/brain"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { navigation } from "@/modules/i18n"
import { brainTabHref, knowledgeSourceHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainDossiersBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page hands the dossiers tab: the header without its tabs, and what the address has open. */
interface BrainDossiersProps {
    readonly header: BrainPageHeading
    /** The dossier open (its findings, its side pane), the finding in view and the draft open over it. */
    readonly dossier: string | undefined
    /** The view of the tab: the list of dossiers or the map; the node the address selects on the map. */
    readonly mode: "list" | "map"
    readonly node: string | undefined
    readonly finding: string | undefined
    readonly draft: string | undefined
}

/**
 * The connected dossiers tab of the Second Brain: the checklist's dossiers by category with the figures of the whole set, the
 * dossier the address opens with the findings of its review, and the side pane that says what it lacks and what it holds.
 */
export const BrainDossiers = (props: BrainDossiersProps) => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const isMap = props.mode === "map"
    const header = useBrainPageHeader(isMap ? "map" : "dossiers", props.header)
    const desk = useBrainDossierDesk({ dossier: isMap ? props.node : props.dossier, mode: props.mode })
    const map = useBrainMapView({ node: props.node, isWaiting: desk.view.isWaiting })
    const checklist = useChecklistImport(desk.on.retry, member.canWrite)
    const findings = useDossierFindingsView(
        desk.openId === null
            ? { kind: "map", nodeId: undefined }
            : { kind: "dossier", dossierId: desk.openId, findingId: props.finding },
    )
    const remedy = useDossierRemedyDrawer({
        draftId: props.draft,
        dossierId: props.dossier,
        findingId: props.finding,
    })
    const [isAsideOpen, setAsideOpen] = useState(false)
    return (
        <BrainDossiersBase
            props={{
                header: header.props,
                panelId: `${header.props.tabs.panelPrefix}dossiers`,
                copy: useDossierCopy(),
                mode: props.mode,
                desk: desk.view,
                findings: waitingFindingsOf(desk.view.isWaiting, findings.props),
                remedy,
                checklist: checklist.view,
                map: isMap ? map.view : null,
                ownerDialog: desk.owner.dialog,
                isAsideOpen,
            }}
            on={{
                reviewAll: header.on.reviewAll,
                selectTab: header.on.selectTab,
                setMode: (mode) =>
                    router.push(workspaceHref(workspaceId, brainTabHref(mode === "map" ? "map" : "dossiers"))),
                selectNode: map.on.select,
                setMapFilter: map.on.setFilter,
                openHref: (href) => router.push(href),
                openAssign: desk.owner.open,
                submitOwner: desk.owner.submit,
                closeOwner: desk.owner.close,
                setQuery: desk.on.setQuery,
                select: desk.on.select,
                back: desk.on.back,
                retry: desk.on.retry,
                closeAside: desk.on.closeAside,
                asideOpenChange: setAsideOpen,
                openMap: () => {
                    if (desk.openId !== null)
                        router.push(workspaceHref(workspaceId, brainTabHref("map", { node: desk.openId })))
                },
                openSources: () => router.push(workspaceHref(workspaceId, brainTabHref("sources"))),
                openDocument: (id) => router.push(workspaceHref(workspaceId, knowledgeSourceHref(id))),
                ...checklist.on,
                setFilter: findings.on.setFilter,
                review: findings.on.review,
                act: findings.on.action,
                loadMore: findings.on.loadMore,
                submitDialog: findings.on.submitDialog,
                closeDialog: findings.on.closeDialog,
            }}
        />
    )
}
