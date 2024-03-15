import { OrderGamesOpts } from "@shared/game/GameFilter";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist } from "@shared/interfaces";
import { GamePlatform } from "@shared/platform/interfaces";
import { ErrorCopy } from "../util/misc";
import { PlaylistManager } from "@back/playlist/PlaylistManager";

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
};

export type LoadPlatformError = ErrorCopy & {
    /** File path of the platform file the error is related to. */
    filePath: string;
};
