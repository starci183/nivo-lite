import { TelegramConnectionPage } from "@/features/pages/TelegramConnectionPage"

/** The document title of this page. */
export { telegramConnectionMetadata as generateMetadata } from "@/features/pages/TelegramConnectionPage"

type PageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** Adapts the Telegram bot connection route to its page owner. */
const Page = (props: PageProps) => <TelegramConnectionPage params={props.params} />

export default Page
