import { WebContents } from 'electron';
import { ReactNode } from 'react';
import { IGameCollection } from '../shared/game/interfaces';
import { GameThumbnailCollection } from './GameThumbnailCollection';

/**
 * "match" object from 'react-router' and 'history' npm packages
 * @property {any} params Key/value pairs parsed from the URL corresponding to the dynamic segments of the path
 * @property {boolean} isExact true if the entire URL was matched (no trailing characters)
 * @property {string} path The path pattern used to match. Useful for building nested <Route>s
 * @property {string} url The matched portion of the URL. Useful for building nested <Link>s
 */
export interface IMatch {
  params: any;
  isExact: boolean;
  path: string;
  url: string;
}

export interface IDefaultProps {
  children?: ReactNode;
}

/** An object that contains useful stuff and is passed throughout the react app as a prop/state
 * (This should be temporary and used for quick and dirty testing and implementation)
 * (Replace this with something more thought out and maintainable once the project has more structure)
 */
export interface ICentralState {
  /** All games that can be browsed and launched */
  collection?: IGameCollection;
  /** Path to the root folder of FlashPoint */
  flashpointPath?: string;
  /** Lookup table for all games thumbnail filenames */
  gameThumbnails: GameThumbnailCollection;
}
