import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { getDefaultBooleanFilter, getDefaultFieldFilter, getDefaultGameFilter, isGameFilterEmpty, mergeGameFilters, parseAdvancedFilter, parseUserInput } from "@renderer/util/search";
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
  advancedFilter: AdvancedFilter;
  filter: GameFilter;
  loaded: boolean;
}

export type AdvancedFilter = {
  installed?: boolean;
  recommended?: boolean;
  series: string[];
  developer: string[];
  publisher: string[];
  genre: string[];
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

export type SearchAdvancedFilterAction = {
  view: string;
  filter: AdvancedFilter;
}

export type SearchFilterRecommendedAction = {
  view: string;
  value?: boolean;
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
            advancedFilter: {
              series: [],
              developer: [],
              publisher: [],
              genre: [],
            },
            loaded: false,
            filter: {
              subfilters: [],
              whitelist: getDefaultFieldFilter(),
              blacklist: getDefaultFieldFilter(),
              exactWhitelist: getDefaultFieldFilter(),
              exactBlacklist: getDefaultFieldFilter(),
              booleans: getDefaultBooleanFilter(),
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
        view.filter = createFilter(view);
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
        view.filter = createFilter(view);
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
        view.filter = createFilter(view);
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
    },
    setAdvancedFilter(state: SearchState, { payload }: PayloadAction<SearchAdvancedFilterAction>) {
      const view = state.views[payload.view];
      if (view) {
        view.advancedFilter = payload.filter;
        view.filter = createFilter(view);
      }
    },
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

function createFilter(view: ResultsView): GameFilter {
  // Build filter for this new search
  let newFilter = parseUserInput(view.text);
  // Merge all filters
  if (view.selectedPlaylist && view.selectedPlaylist.filter) {
    if (isGameFilterEmpty(newFilter)) {
      newFilter = view.selectedPlaylist.filter;
    } else {
      newFilter = mergeGameFilters(view.selectedPlaylist.filter, newFilter);
    }
  }
  const advFilter = parseAdvancedFilter(view.advancedFilter);
  if (!isGameFilterEmpty(advFilter)) {
    if (isGameFilterEmpty(newFilter)) {
      newFilter = advFilter;
    } else {
      newFilter = mergeGameFilters(advFilter, newFilter);
    }
  }

  console.log(newFilter);

  return newFilter;
}

export const { setSearchText, setViewGames, initializeViews, selectPlaylist, selectGame, forceSearch, setOrderBy, setOrderReverse,
  setAdvancedFilter } = searchSlice.actions;
export default searchSlice.reducer;