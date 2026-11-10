import { TelegramConnectionPage } from "@/features/pages/TelegramConnectionPage"

/** The document title of this page. */
export { telegramConnectionMetadata as generateMetadata } from "@/features/pages/TelegramConnectionPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Adapts the Telegram bot connection route to its page owner; the query names the open tab. */
const Page = (props: PageProps) => <TelegramConnectionPage params={props.params} searchParams={props.searchParams} />

export default Page
