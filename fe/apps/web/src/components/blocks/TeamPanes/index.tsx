"use client"

import { useTeamPanesView } from "@/hooks/teamPanes"
import { TeamPanesBase } from "./component"

/** Reads the team, localizes it and revalidates on demand; the narrowing, the opened record and the phone pane live in the hook. */
export const TeamPanes = () => {
    const view = useTeamPanesView()
    return <TeamPanesBase props={view.props} on={view.on} />
}
