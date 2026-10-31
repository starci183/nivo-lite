import type { AgentGraphPhoneView, AgentGraphSideTab } from "@/modules/types"

/** The pane that holds the tab line, the body and, for the chat, the composer. */
const SIDE_AREAS: ReadonlyArray<string> = ["phonetabs", "tabs", "body"]

/** The areas of the Setup grid on a phone: the switch and the one pane it picks; the composer row exists only while the chat shows. */
export const phoneAreasOf = (phoneView: AgentGraphPhoneView, sideTab: AgentGraphSideTab): ReadonlyArray<string> => {
    if (phoneView === "branches") return ["phonetabs", "branches"]
    if (phoneView === "graph") return ["phonetabs", "graph"]
    return sideTab === "chat" ? [...SIDE_AREAS, "foot"] : SIDE_AREAS
}

/** The areas of the Setup grid on a laptop: the map beside the tab line, the body and, for the chat, the composer. */
export const mediumAreasOf = (sideTab: AgentGraphSideTab): ReadonlyArray<string> =>
    sideTab === "chat" ? ["graph tabs", "graph body", "graph foot"] : ["graph tabs", "graph body"]

/** The row tracks of the phone grid: the switch, the tab line and the composer take their height, the rest takes what is left. */
export const phoneRowsOf = (areas: ReadonlyArray<string>): ReadonlyArray<"auto" | "fill"> =>
    areas.map((area) => (area === "tabs" || area === "phonetabs" || area === "foot" ? "auto" : "fill"))

/** The row tracks of the laptop grid. */
export const mediumRowsOf = (sideTab: AgentGraphSideTab): ReadonlyArray<"auto" | "fill"> =>
    sideTab === "chat" ? ["auto", "fill", "auto"] : ["auto", "fill"]
