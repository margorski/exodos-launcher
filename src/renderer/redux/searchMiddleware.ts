import { PayloadAction, isAnyOf } from "@reduxjs/toolkit";
import { startAppListening } from "./listenerMiddleware";
import { ResultsView, SearchSetTextAction, selectPlaylist, setSearchText, setViewGames } from "./searchSlice";
import { IGameInfo } from "@shared/game/interfaces";
import { FieldFilter, GameFilter } from "@shared/interfaces";
import { debounce } from "@shared/utils/debounce";
import store, { RootState } from "./store";
import { INSTALLED_GAMES_PLAYLIST_PREFIX } from "@shared/game/GameFilter";

const debounceSearch = debounce((state: RootState, viewName: string, view: ResultsView) => {
  let games = state.gamesState.games;
  console.log('start ' + games.length);

  // Check if we're a special installed games playlist
  if (view.selectedPlaylist) {
    if (view.selectedPlaylist.filename.startsWith(INSTALLED_GAMES_PLAYLIST_PREFIX)) {
      const platform = view.selectedPlaylist.filename.split('_').slice(1).join('_');
      games = games.filter(g => g.installed && g.platform === platform);
    // Narrow by playlist if has explicit games and no dynamic filters
    } else if (view.selectedPlaylist.games) {
      const playlistGameIds = view.selectedPlaylist.games.map(g => g.id);
      games = games.filter(g => playlistGameIds.includes(g.id));
    }
  } else {
    // Not in a playlist, treat view name as platform
    console.log(viewName);
    console.log(games);
    games = games.filter(g => g.platform === viewName);
  }


  console.log('after playlist ' + games.length);

  // Narrow by filter
  games = filterGames(games, view.filter);

  console.log(`Results: ${games.length}`);

  // Update games in state
  store.dispatch(setViewGames({
    view: viewName,
    games,
  }));
}, 150);

export function addSearchMiddleware() {
  startAppListening({
    matcher: isAnyOf(setSearchText, selectPlaylist),
    effect: async(action: PayloadAction<any>, listenerApi) => {
      const state = listenerApi.getState();
      const view = state.searchState.views[action.payload.view];

      if (view) {
        // Perform search
        debounceSearch(state, action.payload.view, view);
      }
    }
  })
};

function filterGames(games: IGameInfo[], filter: GameFilter): IGameInfo[] {
  let newGames = [...games];

  // Handle subfilters
  if (filter.subfilters.length > 0) {
    if (!filter.matchAny) {
      // Get join of all subfilters for an AND
      const subfilteredGames = filter.subfilters.map(f => filterGames(newGames, f));
      console.log(subfilteredGames);

      // Get the intersection of all id sets
      const commonIds = subfilteredGames.reduce((acc, array) => {
        const ids = new Set(array.map(obj => obj.id));
        return new Set([...acc].filter(id => ids.has(id)));
      }, new Set(subfilteredGames[0].map(obj => obj.id)));
      
      // Filter objects based on the common ids
      newGames = subfilteredGames[0].filter(obj => commonIds.has(obj.id));
    } else {
      // Join all members of the subfilter for OR
      const subfilteredGames = filter.subfilters.flatMap(f => filterGames(newGames, f));
      const uniqueItemsMap: Map<string, IGameInfo> = new Map();

      for (const game of subfilteredGames) {
        if (!uniqueItemsMap.has(game.id)) {
          uniqueItemsMap.set(game.id, game);
        }
      }
      
      newGames = Array.from(uniqueItemsMap.values());
    }
  }


  // Handle own filter

  if (!isFilterEmpty(filter.exactWhitelist)) {
    console.log('exact whitelist');
    const filterFunc = exactStringFilterFieldFactory(filter.exactWhitelist, filter.matchAny);
    newGames = newGames.filter(filterFunc);
  }

  if (!isFilterEmpty(filter.exactBlacklist)) {
    console.log('exact blacklist');
    const filterFunc = not(exactStringFilterFieldFactory(filter.exactBlacklist, filter.matchAny));
    newGames = newGames.filter(filterFunc);
  }

  if (!isFilterEmpty(filter.whitelist)) {
    console.log('whitelist');
    const filterFunc = fuzzyStringFilterFieldFactory(filter.whitelist, filter.matchAny);
    newGames = newGames.filter(filterFunc);
  }

  if (!isFilterEmpty(filter.blacklist)) {
    console.log('blacklist');
    const filterFunc = not(fuzzyStringFilterFieldFactory(filter.blacklist, filter.matchAny));
    newGames = newGames.filter(filterFunc);
  }

  return newGames;
}

function lowerCaseFilter(filter: FieldFilter): FieldFilter {
  return {
    generic: filter.generic.map(s => s.toLowerCase()),
    id: filter.id.map(s => s.toLowerCase()),
    title: filter.title.map(s => s.toLowerCase()),
    series: filter.series.map(s => s.toLowerCase()),
    developer: filter.developer.map(s => s.toLowerCase()),
    publisher: filter.publisher.map(s => s.toLowerCase()),
    platform: filter.platform.map(s => s.toLowerCase()),
    genre: filter.genre.map(s => s.toLowerCase()),
  }
}

function not<T extends any[]>(func: (...args: T) => boolean) {
  return (...args: T) => {
    return !func(...args);
  }
}

const fieldFilterKeys: Array<keyof FieldFilter> = [
  'id',
  'title',
  'series',
  'developer',
  'publisher',
  'platform',
  'genre',
];

function exactStringFilterFieldFactory(filter: FieldFilter, matchAny: boolean) {
  filter = lowerCaseFilter(filter);
  console.log(filter);

  return (game: IGameInfo) => {
    // Compare generic keys against a few different fields
    if (filter.generic) {
      if (!matchAny) {
        for (const val of filter.generic) {
          if (
            game.title.toLowerCase() !== val &&
            game.series.toLowerCase() !== val &&
            game.developer.toLowerCase() !== val &&
            game.publisher.toLowerCase() !== val
          ) {
            return false;
          }
        }
      } else {
        for (const val of filter.generic) {
          if (
            game.title.toLowerCase() === val ||
            game.series.toLowerCase() === val ||
            game.developer.toLowerCase() === val ||
            game.publisher.toLowerCase() === val
          ) {
            return false;
          }
        }
      }
    }

    // Compare each field that's filterable by a string
    for (const key of fieldFilterKeys) {
      if (filter[key]) {
        if (!matchAny) {
          // Match all terms
          for (const val of filter[key]) {
            if (!((game[key as keyof IGameInfo] as string).toLowerCase() === val)) {
              return false;
            }
          }
        } else {
          // Match any term
          for (const val of filter[key]) {
            if ((game[key as keyof IGameInfo] as string).toLowerCase() === val) {
              return true;
            }
          }
        }
      }
    }

    // If we made it here, we've either matched all (AND) or matched none (OR)
    return matchAny;
  };
}

function fuzzyStringFilterFieldFactory(filter: FieldFilter, matchAny: boolean) {
  filter = lowerCaseFilter(filter);
  console.log(filter);
  console.log('match any ' + matchAny);

  return (game: IGameInfo) => {
    // Compare generic keys against a few different fields
    if (filter.generic) {
      if (!matchAny) {
        for (const val of filter.generic) {
          if (
            !game.title.toLowerCase().includes(val) &&
            !game.series.toLowerCase().includes(val) &&
            !game.developer.toLowerCase().includes(val) &&
            !game.publisher.toLowerCase().includes(val)
          ) {
            return false;
          }
        }
      } else {
        for (const val of filter.generic) {
          if (
            game.title.toLowerCase().includes(val) ||
            game.series.toLowerCase().includes(val) ||
            game.developer.toLowerCase().includes(val) ||
            game.publisher.toLowerCase().includes(val)
          ) {
            return false;
          }
        }
      }
    }

    // Compare each field that's filterable by a string
    for (const key of fieldFilterKeys) {
      if (filter[key]) {
        if (!matchAny) {
          // Match all terms
          for (const val of filter[key]) {
            if (!((game[key as keyof IGameInfo] as string).toLowerCase().includes(val))) {
              return false;
            }
          }
        } else {
          // Match any term
          for (const val of filter[key]) {
            if ((game[key as keyof IGameInfo] as string).toLowerCase().includes(val)) {
              return true;
            }
          }
        }
      }
    }

    // If we made it here, we've either matched all (AND) or matched none (OR)
    return !matchAny;
  };
}

function isFilterEmpty(filter: FieldFilter) {
  return !(
    filter.generic.length > 0 ||
    filter.id.length > 0 ||
    filter.title.length > 0 ||
    filter.series.length > 0 ||
    filter.developer.length > 0 ||
    filter.publisher.length > 0 ||
    filter.platform.length > 0 ||
    filter.genre.length > 0
  )
}