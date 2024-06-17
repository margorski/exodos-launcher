import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { getDefaultFieldFilter, mergeGameFilters, parseUserInput } from "@renderer/util/search";
import { deepCopy, fixSlashes } from "@shared/Util";
import { IGameInfo } from "@shared/game/interfaces";
import { GameFilter, GamePlaylist } from "@shared/interfaces";
import { setGameInstalled } from "./gamesSlice";
import * as path from 'path';
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { getOrderFunction } from "@shared/game/GameFilter";

export type ResultsView = {
  selectedGame?: IGameInfo,
  selectedPlaylist?: GamePlaylist,
  games: IGameInfo[];
  orderBy: GameOrderBy;
  orderReverse: GameOrderReverse
  text: string;
  filter: GameFilter;
  loaded: boolean;
}

type SearchState = {
  views: Record<string, ResultsView>,
}

export type SearchSetTextAction = {
  view: string;
  text: string;
}

export type SearchSetViewGamesAction = {
  view: string;
  games: IGameInfo[];
};

export type SearchSetGameAction = {
  view: string;
  game?: IGameInfo;
}

export type SearchSetPlaylistAction = {
  view: string;
  playlist?: GamePlaylist;
}

export type SearchOrderByAction = {
  view: string;
  value: GameOrderBy;
}

export type SearchOrderReverseAction = {
  view: string;
  value: GameOrderReverse;
}

export type SearchViewAction = {
  view: string;
}

const initialState: SearchState = {
  views: {}
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    initializeViews(state: SearchState, { payload }: PayloadAction<string[]>) {
      console.log(`Creating views for: ${payload}`);
      for (const view of payload) {
        if (!state.views[view]) {
          state.views[view] = {
            games: [],
            text: "",
            orderBy: "title",
            orderReverse: "ascending",
            loaded: false,
            filter: {
              subfilters: [],
              whitelist: getDefaultFieldFilter(),
              blacklist: getDefaultFieldFilter(),
              exactWhitelist: getDefaultFieldFilter(),
              exactBlacklist: getDefaultFieldFilter(),
              matchAny: false
            }
          }
        }
      }
    },
    setSearchText(state: SearchState, { payload }: PayloadAction<SearchSetTextAction>) {
      const view = state.views[payload.view];
      if (view) {
        view.text = payload.text;
        // Build filter for this new search
        view.filter = parseUserInput(payload.text);
        // Merge all filters
        if (view.selectedPlaylist && view.selectedPlaylist.filter) {
          view.filter = mergeGameFilters(view.selectedPlaylist.filter, view.filter);
        }
      }
    },
    setViewGames(state: SearchState, { payload }: PayloadAction<SearchSetViewGamesAction>) {
      if (state.views[payload.view]) {
        state.views[payload.view].games = payload.games;
      }
    },
    selectPlaylist(state: SearchState, { payload }: PayloadAction<SearchSetPlaylistAction>) {
      const view = state.views[payload.view];
      if (view) {
        const playlist = payload.playlist ? deepCopy(payload.playlist) : undefined;
        view.selectedPlaylist = playlist;

        // Changed playlist, rebuild query
        view.filter = parseUserInput(view.text);

        if (view && payload.playlist && payload.playlist.filter) {
          // Merge all filters
          view.filter = mergeGameFilters(payload.playlist.filter, view.filter);
        }

        console.log(view.filter);
      }
    },
    selectGame(state: SearchState, { payload }: PayloadAction<SearchSetGameAction>) {
      const view = state.views[payload.view];
      if (view) {
        view.selectedGame = payload.game ? deepCopy(payload.game) : undefined;
      }
    },
    forceSearch(state: SearchState, { payload }: PayloadAction<SearchViewAction>) {
      const view = state.views[payload.view];
      if (view) {
        // Build filter for this new search
        view.filter = parseUserInput(view.text);
        // Merge all filters
        if (view.selectedPlaylist && view.selectedPlaylist.filter) {
          view.filter = mergeGameFilters(view.selectedPlaylist.filter, view.filter);
        }
      }
    },
    setOrderBy(state: SearchState, { payload }: PayloadAction<SearchOrderByAction>) {
      const view = state.views[payload.view];
      if (view) {
        view.orderBy = payload.value;
        const orderFn = getOrderFunction(view.orderBy, view.orderReverse);
        view.games = view.games.sort(orderFn);
      }
    },
    setOrderReverse(state: SearchState, { payload }: PayloadAction<SearchOrderReverseAction>) {
      const view = state.views[payload.view];
      if (view) {
        view.orderReverse = payload.value;
        const orderFn = getOrderFunction(view.orderBy, view.orderReverse);
        view.games = view.games.sort(orderFn);
      }
    }
  },
  extraReducers: (builder) => {
    builder.addCase(setGameInstalled, (state, { payload }) => {
      const { gameDataPath, value } = payload;
      const dirname = path.basename(gameDataPath);

      for (const viewName of Object.keys(state.views)) {
        const view = state.views[viewName];
        if (view.selectedGame) {
          if (fixSlashes(view.selectedGame.rootFolder).endsWith(`/${dirname}`)) {
            view.selectedGame.installed = value;
          }
        }
      }
    });
  },
});

export const { setSearchText, setViewGames, initializeViews, selectPlaylist, selectGame, forceSearch, setOrderBy, setOrderReverse } = searchSlice.actions;
export default searchSlice.reducer;