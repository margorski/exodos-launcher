import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { fixSlashes } from "@shared/Util";
import {
    IAdditionalApplicationInfo,
    IGameCollection,
    IGameInfo,
} from "@shared/game/interfaces";
import * as path from "path";

export enum GamesInitState {
    WAITING = 0,
    LOADING,
    LOADED,
}

export type GamesState = {
    initState: GamesInitState;
    totalGames: number;
    libraries: string[];
} & IGameCollection;

export type GameInstalledAction = {
    gameDataPath: string;
    value: boolean;
};

export type AddExtrasAction = {
    addApps: IAdditionalApplicationInfo[];
};

export type AddVideoAction = {
    videoPath: string;
};

const initialState: GamesState = {
    games: [],
    addApps: [],
    initState: GamesInitState.WAITING,
    totalGames: 0,
    libraries: [],
};

export function getGameTitleForVideo(game: IGameInfo) {
    const gameTitle = path
        .basename(fixSlashes(game.applicationPath))
        .split(".")[0];
    return gameTitle;
}

const gamesSlice = createSlice({
    name: "games",
    initialState,
    reducers: {
        /** Initialize the games collection */
        initialize: (state: GamesState) => {
            state.initState = Math.max(GamesInitState.LOADING, state.initState);
        },
        /** Overwrite the entire games collection */
        setGames: (
            state: GamesState,
            { payload }: PayloadAction<IGameCollection>
        ) => {
            state.games = payload.games;
            state.addApps = payload.addApps;
            state.totalGames = payload.games.length;
            state.initState = GamesInitState.LOADED;
        },
        /** Set list of libraries */
        setLibraries: (
            state: GamesState,
            { payload }: PayloadAction<string[]>
        ) => {
            state.libraries = payload;
        },
        /** Set whether a game is installed or not */
        setGameInstalled: (
            state: GamesState,
            { payload }: PayloadAction<GameInstalledAction>
        ) => {
            const { gameDataPath, value } = payload;
            const dirname = path.basename(gameDataPath);

            // Find matching game, if exists
            const idx = state.games.findIndex((game) => {
                return fixSlashes(game.rootFolder).endsWith(`/${dirname}`);
            });
            if (idx > -1) {
                state.games[idx].installed = value;
            }
        },
        addExtras: (
            state: GamesState,
            { payload }: PayloadAction<AddExtrasAction>
        ) => {
            state.addApps = [...state.addApps, ...payload.addApps];
        },
        addVideo: (
            state: GamesState,
            { payload }: PayloadAction<AddVideoAction>
        ) => {
            const title = payload.videoPath.split("/").pop()?.split(".mp4")[0];
            if (title) {
                const game = state.games.find((g) => {
                    return getGameTitleForVideo(g) === title;
                });
                if (game) {
                    console.debug(`Found the game for the new video: ${game}`);
                    game.media.video = payload.videoPath;
                }
            }
        },
    },
});

export const {
    initialize,
    setLibraries,
    setGames,
    setGameInstalled,
    addExtras,
    addVideo,
} = gamesSlice.actions;
export default gamesSlice.reducer;
