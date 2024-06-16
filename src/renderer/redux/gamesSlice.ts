import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { fixSlashes } from "@shared/Util";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import * as path from 'path';

export enum GamesInitState {
  WAITING = 0,
  LOADING,
  LOADED
};

export type GamesCollection = {
  games: IGameInfo[],
  addApps: IAdditionalApplicationInfo[],
};

export type GamesState = {
  initState: GamesInitState,
  totalGames: number;
  libraries: string[];
} & GamesCollection;

export type GameInstalledAction = {
  gameDataPath: string;
  value: boolean;
}

const initialState: GamesState = {
  games: [],
  addApps: [],
  initState: GamesInitState.WAITING,
  totalGames: 0,
  libraries: [],
};

const gamesSlice = createSlice({
  name: 'games',
  initialState,
  reducers: {
    /** Initialize the games collection */
    initialize: (state: GamesState) => {
      // Loading occurs inside middleware since it's asynchronous
      return {
        ...state,
        initState: Math.max(GamesInitState.LOADING, state.initState)
      };
    },
    /** Overwrite the entire games collection */
    setGames: (state: GamesState, { payload }: PayloadAction<GamesCollection>) => {      
      return {
        ...state,
        games: payload.games,
        addApps: payload.addApps,
        totalGames: Object.keys(payload.games).length,
        initState: GamesInitState.LOADED,
      }
    },
    /** Set list of libraries */
    setLibraries: (state: GamesState, { payload }: PayloadAction<string[]>) => {      
      return {
        ...state,
        libraries: payload,
      };
    },
    /** Set whether a game is installed or not */
    setGameInstalled: (state: GamesState, { payload }: PayloadAction<GameInstalledAction>) => {
      const { gameDataPath, value } = payload;
      const dirname = path.basename(gameDataPath);

      // Find matching game, if exists
      const idx = state.games.findIndex(game => {
        return fixSlashes(game.rootFolder).endsWith(`/${dirname}`);
      })
      if (idx > -1) {
        state.games[idx].installed = value;
      }
    }
  }
});

export const { initialize, setLibraries, setGames, setGameInstalled } = gamesSlice.actions;
export default gamesSlice.reducer;