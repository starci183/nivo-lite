import { NivoBrowse } from "@/features/knowledge/NivoBrowse"
import { listNivoKnowledge } from "@/lib/knowledge/index"

/** NIVO base knowledge, read-only. */
const Page = async () => <NivoBrowse items={await listNivoKnowledge()} />

export default Page
