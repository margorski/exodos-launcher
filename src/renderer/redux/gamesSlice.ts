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
        totalGames: Object.keys(payload.games).length
      }
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
        // Game found, update state
        const newGames = [...state.games];
        newGames[idx].installed = payload.value;
        return {
          ...state,
          games: newGames
        };
      }

      return state;
    }
  }
});

export const { initialize, setGames, setGameInstalled } = gamesSlice.actions;
export default gamesSlice.reducer;