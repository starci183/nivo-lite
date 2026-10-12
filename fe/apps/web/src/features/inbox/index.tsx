import type { InboundEvent } from "@/lib/flow-types"
import { newEventId } from "./model"
import { InboxView } from "./view"

/** Props for {@link InboxPage}. */
export type InboxPageProps = { readonly events: ReadonlyArray<InboundEvent>; readonly nowIso: string }

/** The "Đầu vào" page: a permanent simulated-channels notice, the inbound simulator and the feed of received inputs. */
export const InboxPage = ({ events, nowIso }: InboxPageProps) => <InboxView events={events} nowIso={nowIso} initialEventId={newEventId()} />
