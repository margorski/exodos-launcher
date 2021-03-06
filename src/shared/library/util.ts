import { LangContainer } from '../lang';
import { removeFileExtension } from '@shared/Util';
/**
 * Get the title of a library item from a language sub-container (or return the item's route if none was found).
 * @param item Item to get title of.
 * @param lang Language sub-container to look for title in.
 */
export function getLibraryItemTitle(library: string, lang?: LangContainer['libraries']): string {
  return removeFileExtension(library);
}
