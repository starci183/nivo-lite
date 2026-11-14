import { webrenewText } from "../../modules/webrenew/copy"
import { type RoundMessageNode, roundMessageNodeOf } from "../talk/round-message.node"

/** `webrenew.round-message`: the message a round of the renewal answer's talk answers (the shared factory, `nodes/talk`). */
export const webrenewRoundMessageNode: RoundMessageNode = roundMessageNodeOf({ module: "webrenew", title: webrenewText("node.round-message.title") })
