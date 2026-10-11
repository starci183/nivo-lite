import { BrainView } from "@/features/brain"

/** STATE-8: the Second Brain page itself, with no data yet - the same tree, its figures, graph and rail rows as skeletons. */
const BrainLoading = () => <BrainView isLoading facts={[]} documents={[]} lessons={[]} lenses={[]} canWrite business="" />

export default BrainLoading
