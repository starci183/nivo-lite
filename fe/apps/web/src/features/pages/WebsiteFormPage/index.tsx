import { WebsiteForm } from "@/components/blocks/WebsiteForm"

/** The key of the hosted form resolved by the thin route. */
interface WebsiteFormPageProps {
    readonly siteKey: string
}

/** The public page of a shop's website form: the block is its root. */
export const WebsiteFormPage = (props: WebsiteFormPageProps) => <WebsiteForm siteKey={props.siteKey} />
