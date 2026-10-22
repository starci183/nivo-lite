"use client"

import { useWorkThreadsPage } from "@/hooks/workThreads"
import { WorkThreadBoardBase } from "./component"

/** The work threads page: the threads are read in the browser; the open thread, the draft and the tags picked are held by the page hook. */
export const WorkThreadBoard = () => {
    const page = useWorkThreadsPage()
    return <WorkThreadBoardBase props={page.props} on={page.on} />
}
