import { websalesText } from "../../modules/websales/copy"
import { type RoundMessageNode, roundMessageNodeOf } from "../talk/round-message.node"

/** `websales.round-message`: the message a round of the enquiry's talk answers (the shared factory, `nodes/talk`). */
export const websalesRoundMessageNode: RoundMessageNode = roundMessageNodeOf({ module: "websales", title: websalesText("node.round-message.title") })
