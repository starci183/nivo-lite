/** Wave 3 shim: the app UI lives in `components/{leaves,composites,blocks}`; this barrel keeps the old `@/ui` imports resolving until they move. */
export { nivoIconSource } from "../components/leaves/Icon"
export type { IconName } from "../components/leaves/Icon"
export { Icon as NivoIcon } from "../components/leaves/Icon"
export { TileIcon } from "../components/composites/TileIcon"
