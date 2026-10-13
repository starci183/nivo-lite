import { pageAt } from "@/modules/guide"

/** The guide page the reader is on (by its path), or `undefined` off the guide map. */
export const useGuidePage = (pathname: string) => pageAt(pathname)
