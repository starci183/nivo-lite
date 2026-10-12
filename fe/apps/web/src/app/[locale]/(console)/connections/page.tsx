import { ConnectionsPage } from "@/features/connections"

/** Connections ("Kết nối"): the workspace's own Telegram bots, SePay bank feeds and Zalo OA. Owner and manager only. */
const Page = ({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }) => <ConnectionsPage searchParams={searchParams} />

export default Page
