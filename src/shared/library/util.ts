import { removeFileExtension } from "@shared/Util";
/**
 * Get the title of a library item
 * @param item Item to get title of.
 */
export function getLibraryItemTitle(library: string): string {
    return removeFileExtension(library);
}
