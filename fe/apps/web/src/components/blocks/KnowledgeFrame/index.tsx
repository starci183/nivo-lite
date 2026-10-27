import { KnowledgeFrameBase } from "./component"
import type { KnowledgeFrameBaseProps } from "./component"

/** What the heading of a page under the documents is handed: the resolved trail and heading. */
type KnowledgeFrameProps = KnowledgeFrameBaseProps["props"]

/** The trail (home, Second Brain, documents, this page) and the heading of a page under the documents. */
export const KnowledgeFrame = (props: KnowledgeFrameProps) => <KnowledgeFrameBase props={props} />
