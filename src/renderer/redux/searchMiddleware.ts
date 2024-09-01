import { PayloadAction, isAnyOf } from "@reduxjs/toolkit";
import {
    isBooleanFilterEmpty,
    isCompareFilterEmpty,
    isFilterEmpty,
} from "@renderer/util/search";
import { getOrderFunction } from "@shared/game/GameFilter";
import { IGameInfo } from "@shared/game/interfaces";
import {
    BooleanFilter,
    CompareFilter,
    FieldFilter,
    GameFilter,
} from "@shared/interfaces";
import { debounce } from "@shared/utils/debounce";
import { startAppListening } from "./listenerMiddleware";
import {
    ResultsView,
    SearchViewAction,
    forceSearch,
    selectGame,
    selectPlaylist,
    setAdvancedFilter,
    setSearchText,
    setViewGames,
} from "./searchSlice";
import store, { RootState } from "./store";
import { GameUpdatedAction, updateGame } from "./gamesSlice";

export function addSearchMiddleware() {
    startAppListening({
        matcher: isAnyOf(
            setSearchText,
            selectPlaylist,
            setAdvancedFilter,
            forceSearch
        ),
        effect: async (
            action: PayloadAction<SearchViewAction>,
            listenerApi
        ) => {
            const state = listenerApi.getState();
            const view = state.searchState.views[action.payload.view];

            if (view) {
                // Perform search
                debounceSearch(state, action.payload.view, view);
            }
        },
    });

    // Refresh view when game is updated. Easiest way to have
    // everything in shape.
    startAppListening({
        matcher: isAnyOf(updateGame),
        effect: async (
            action: PayloadAction<GameUpdatedAction>,
            listenerApi
        ) => {
            const state = listenerApi.getState();
            const viewName = action.payload.game.library;
            const view = state.searchState.views[viewName];
            const game = action.payload.game;

            if (view) {
                if (view.selectedGame?.id === game.id)
                    store.dispatch(
                        selectGame({
                            view: viewName,
                            game,
                        })
                    );
                debounceSearch(state, viewName, view);
            }
        },
    });
}

const debounceSearch = debounce(
    (state: RootState, viewName: string, view: ResultsView) => {
        let games = state.gamesState.games;
        console.debug("Start count " + games.length);

        // Check if we're a special installed games playlist
        if (view.selectedPlaylist) {
            if (view.selectedPlaylist.games.length > 0) {
                const playlistGameIds = view.selectedPlaylist.games.map(
                    (g) => g.id
                );
                games = games.filter((g) => playlistGameIds.includes(g.id));
            }
        } else {
            // Not in a playlist, treat view name as platform
            games = games.filter((g) => g.platform === viewName);
        }

        console.debug("Results after playlist " + games.length);

        // Narrow by filter
        games = filterGames(games, view.filter);

        const orderFn = getOrderFunction(view.orderBy, view.orderReverse);
        games = games.sort(orderFn);

        console.debug(`Final Results: ${games.length}`);

        // Update games in state
        store.dispatch(
            setViewGames({
                view: viewName,
                games,
            })
        );
    },
    125
);

function filterGames(games: IGameInfo[], filter: GameFilter): IGameInfo[] {
    let newGames = [...games];
    console.debug("filtering " + games.length);

    // Handle subfilters
    if (filter.subfilters.length > 0) {
        if (!filter.matchAny) {
            // Get join of all subfilters for an AND
            const subfilteredGames = filter.subfilters.map((f) =>
                filterGames(newGames, f)
            );

            // Get the intersection of all id sets
            const commonIds = subfilteredGames.reduce((acc, array) => {
                const ids = new Set(array.map((obj) => obj.id));
                return new Set([...acc].filter((id) => ids.has(id)));
            }, new Set(subfilteredGames[0].map((obj) => obj.id)));

            // Filter objects based on the common ids
            newGames = subfilteredGames[0].filter((obj) =>
                commonIds.has(obj.id)
            );
        } else {
            // Join all members of the subfilter for OR
            const subfilteredGames = filter.subfilters.flatMap((f) =>
                filterGames(newGames, f)
            );
            const uniqueItemsMap: Map<string, IGameInfo> = new Map();

            for (const game of subfilteredGames) {
                if (!uniqueItemsMap.has(game.id)) {
                    uniqueItemsMap.set(game.id, game);
                }
            }

            newGames = Array.from(uniqueItemsMap.values());
        }
    }

    console.debug("after subfilters " + newGames.length);

    // Handle own filter

    if (!isBooleanFilterEmpty(filter.booleans)) {
        const filterFunc = booleanFilterFactory(
            filter.booleans,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.exactWhitelist)) {
        const filterFunc = exactStringFilterFieldFactory(
            filter.exactWhitelist,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.exactBlacklist)) {
        const filterFunc = not(
            exactStringFilterFieldFactory(
                filter.exactBlacklist,
                filter.matchAny
            )
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.whitelist)) {
        const filterFunc = fuzzyStringFilterFieldFactory(
            filter.whitelist,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.blacklist)) {
        const filterFunc = not(
            fuzzyStringFilterFieldFactory(filter.blacklist, filter.matchAny)
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.equalTo)) {
        const filterFunc = equalToFilterFactory(filter.equalTo);
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.greaterThan)) {
        const filterFunc = greaterThanFilterFactory(filter.greaterThan);
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.lessThan)) {
        const filterFunc = lessThanFilterFactory(filter.lessThan);
        newGames = newGames.filter(filterFunc);
    }

    return newGames;
}

function lowerCaseFilter(filter: FieldFilter): FieldFilter {
    return {
        generic: filter.generic.map((s) => s.toLowerCase()),
        id: filter.id.map((s) => s.toLowerCase()),
        title: filter.title.map((s) => s.toLowerCase()),
        series: filter.series.map((s) => s.toLowerCase()),
        developer: filter.developer.map((s) => s.toLowerCase()),
        publisher: filter.publisher.map((s) => s.toLowerCase()),
        platform: filter.platform.map((s) => s.toLowerCase()),
        genre: filter.genre.map((s) => s.toLowerCase()),
        playMode: filter.playMode.map((s) => s.toLowerCase()),
        region: filter.region.map((s) => s.toLowerCase()),
        rating: filter.rating.map((s) => s.toLowerCase()),
    };
}

function not<T extends any[]>(func: (...args: T) => boolean) {
    return (...args: T) => {
        return !func(...args);
    };
}

const fieldFilterKeys: Array<keyof FieldFilter> = [
    "id",
    "title",
    "series",
    "developer",
    "publisher",
    "platform",
    "genre",
    "playMode",
    "region",
    "rating",
];

const booleanFilterKeys: Array<keyof BooleanFilter> = [
    "installed",
    "recommended",
];

const compareFilterKeys: Array<keyof CompareFilter> = [
    "releaseYear",
    "maxPlayers",
];

function exactStringFilterFieldFactory(filter: FieldFilter, matchAny: boolean) {
    filter = lowerCaseFilter(filter);

    return (game: IGameInfo) => {
        // Compare generic keys against a few different fields
        if (filter.generic.length > 0) {
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

        // Compare each field that is filterable by a string
        for (const key of fieldFilterKeys) {
            if (filter[key].length > 0) {
                if (!matchAny) {
                    // Match all terms
                    for (const val of filter[key]) {
                        if (
                            !(
                                (
                                    game[key as keyof IGameInfo] as string
                                ).toLowerCase() === val
                            )
                        ) {
                            return false;
                        }
                    }
                } else {
                    // Match any term
                    for (const val of filter[key]) {
                        if (
                            (
                                game[key as keyof IGameInfo] as string
                            ).toLowerCase() === val
                        ) {
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

function fuzzyStringFilterFieldFactory(filter: FieldFilter, matchAny: boolean) {
    filter = lowerCaseFilter(filter);

    return (game: IGameInfo) => {
        // Compare generic keys against a few different fields
        if (filter.generic.length > 0) {
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

        // Compare each field that is filterable by a string
        for (const key of fieldFilterKeys) {
            if (filter[key].length > 0) {
                if (!matchAny) {
                    // Match all terms
                    for (const val of filter[key]) {
                        if (
                            !(game[key as keyof IGameInfo] as string)
                                .toLowerCase()
                                .includes(val)
                        ) {
                            return false;
                        }
                    }
                } else {
                    // Match any term
                    for (const val of filter[key]) {
                        if (
                            (game[key as keyof IGameInfo] as string)
                                .toLowerCase()
                                .includes(val)
                        ) {
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

function booleanFilterFactory(filter: BooleanFilter, matchAny: boolean) {
    return (game: IGameInfo) => {
        // Compare each field that is filterable by a string
        for (const key of booleanFilterKeys) {
            if (filter[key] !== undefined) {
                if (!matchAny) {
                    // Match all terms
                    if (
                        !(
                            (game[key as keyof IGameInfo] as boolean) ===
                            filter[key]
                        )
                    ) {
                        return false;
                    }
                } else {
                    // Match any term
                    if (
                        (game[key as keyof IGameInfo] as boolean) ===
                        filter[key]
                    ) {
                        return true;
                    }
                }
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return !matchAny;
    };
}

function equalToFilterFactory(filter: CompareFilter) {
    return (game: IGameInfo) => {
        // Compare each field that is filterable by a string
        for (const key of compareFilterKeys) {
            const val = filter[key];
            if (val !== undefined) {
                return (game[key as any as keyof IGameInfo] as any) === val;
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return false;
    };
}

function greaterThanFilterFactory(filter: CompareFilter) {
    return (game: IGameInfo) => {
        // Compare each field that is filterable by a string
        for (const key of compareFilterKeys) {
            const val = filter[key];
            if (val !== undefined) {
                return (game[key as any as keyof IGameInfo] as any) >= val;
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return false;
    };
}

function lessThanFilterFactory(filter: CompareFilter) {
    return (game: IGameInfo) => {
        // Compare each field that is filterable by a string
        for (const key of compareFilterKeys) {
            const val = filter[key];
            if (val !== undefined) {
                return (game[key as any as keyof IGameInfo] as any) < val;
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return false;
    };
}
