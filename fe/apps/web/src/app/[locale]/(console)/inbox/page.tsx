import { unstable_rethrow } from "next/navigation"
import { InboxPage } from "@/features/inbox"
import { listInbound } from "@/lib/flow-queries"

/** Inbox ("Đầu vào"): inbound simulator and the feed of everything NIVO received. A failed load reaches error.tsx (STATE-8 case-4). */
const Page = async () => {
  try {
    const events = await listInbound(40)
    return <InboxPage events={events} nowIso={new Date().toISOString()} />
  } catch (error) {
    unstable_rethrow(error) // Next signals (redirect, notFound, dynamic usage) pass through unlogged
    console.error("[inbox] load failed", error)
    throw error
  }
}

export default Page

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60;
