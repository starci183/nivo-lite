import { PublicLoyaltyPage } from "@/features/pages/PublicLoyaltyPage"

export { publicLoyaltyMetadata as generateMetadata } from "@/features/pages/PublicLoyaltyPage"

/** Rendered per request: the shell reads the slug of the URL. */
export const dynamic = "force-dynamic"

type PageProps = Parameters<typeof PublicLoyaltyPage>[0]

/** Public points check of one shop. */
const Page = (props: PageProps) => <PublicLoyaltyPage params={props.params} />

export default Page
