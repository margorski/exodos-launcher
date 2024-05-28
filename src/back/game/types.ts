import { OrderGamesOpts } from "@shared/game/GameFilter";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist } from "@shared/interfaces";
import { GamePlatform } from "@shared/platform/interfaces";
import { ErrorCopy } from "../util/misc";
import { PlaylistManager } from "@back/playlist/PlaylistManager";
import { PlatformsFile } from "@back/platform/PlatformFile";

export type SearchCache = {
    query: SearchCacheQuery;
    total: number;
    results: IGameInfo[];
};

export type SearchCacheQuery = {
    query: string;
    orderOpts: OrderGamesOpts;
    library?: string;
    playlist?: GamePlaylist | undefined;
};

export type GameManagerState = {
    platforms: GamePlatform[];
    platformsPath: string;
    playlistManager: PlaylistManager;
    installedGames: string[];
    platformsFile: PlatformsFile;
};

export type LoadPlatformError = ErrorCopy & {
    /** File path of the platform file the error is related to. */
    filePath: string;
};

export type ThumbnailList = {
    [key: string]: string;
};