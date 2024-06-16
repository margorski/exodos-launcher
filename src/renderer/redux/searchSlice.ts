import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { getDefaultFieldFilter, mergeGameFilters, parseUserInput } from "@renderer/util/search";
import { IGameInfo } from "@shared/game/interfaces";
import { GameFilter, GamePlaylist } from "@shared/interfaces";

export type ResultsView = {
  selectedGameId?: string,
  selectedPlaylist?: GamePlaylist,
  games: IGameInfo[];
  text: string;
  filter: GameFilter;
  loaded: boolean;
}

type SearchState = {
  currentView: string,
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
  gameId?: string;
}

export type SearchSetPlaylistAction = {
  view: string;
  playlist?: GamePlaylist;
}

const initialState: SearchState = {
  currentView: '',
  views: {}
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    initializeViews(state: SearchState, { payload }: PayloadAction<string[]>) {
      console.log(`Creating views for: ${payload}`);
      const newViews = {...state.views};
      for (const view of payload) {
        if (!newViews[view]) {
          const newView: ResultsView = {
            games: [],
            text: "",
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

          newViews[view] = newView;
        }
      }
      
      return {
        ...state,
        views: newViews
      };
    },
    setSearchText(state: SearchState, { payload }: PayloadAction<SearchSetTextAction>) {
      const view = state.views[payload.view];
      if (view) {
        // Build filter for this new search
        let newFilter = parseUserInput(payload.text);
        // Merge all filters
        if (view.selectedPlaylist && view.selectedPlaylist.filter) {
          console.log('playlist filter applied');
          newFilter = mergeGameFilters(view.selectedPlaylist.filter, newFilter);
        }

        return {
          ...state,
          views: {
            ...state.views,
            [payload.view]: {
              ...state.views[payload.view],
              text: payload.text,
              filter: newFilter,
            }
          }
        }
      }

      return state;
    },
    setViewGames(state: SearchState, { payload }: PayloadAction<SearchSetViewGamesAction>) {
      if (state.views[payload.view]) {
        return {
          ...state,
          views: {
            ...state.views,
            [payload.view]: {
              ...state.views[payload.view],
              games: payload.games,
            }
          }
        }
      }

      return state;
    },
    selectPlaylist(state: SearchState, { payload }: PayloadAction<SearchSetPlaylistAction>) {
      const view = state.views[payload.view];
      if (view) {
        const newView = {...view};
        newView.selectedPlaylist = payload.playlist;

        if (view && !payload.playlist) {
          // Deselected playlist, rebuild query
          let newFilter = parseUserInput(view.text);
          newView.filter = newFilter;
        }

        if (view && payload.playlist && payload.playlist.filter) {
          // Build filter for this new search
          let newFilter = parseUserInput(view.text);
          // Merge all filters
          newFilter = mergeGameFilters(payload.playlist.filter, newFilter);
          newView.filter = newFilter;
          console.log('filter');
          console.log(JSON.stringify(newFilter, undefined, 2));
        }
        
        return {
          ...state,
          views: {
            ...state.views,
            [payload.view]: newView
          }
        }
      }

      return state;
    },
    selectGame(state: SearchState, { payload }: PayloadAction<SearchSetGameAction>) {
      if (state.views[payload.view]) {
        return {
          ...state,
          views: {
            ...state.views,
            [payload.view]: {
              ...state.views[payload.view],
              selectedGameId: payload.gameId
            }
          }
        }
      }

      return state;
    }
  }
});

export const { setSearchText, setViewGames, initializeViews, selectPlaylist, selectGame } = searchSlice.actions;
export default searchSlice.reducer;