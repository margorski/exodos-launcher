import { OrderGamesOpts } from "@shared/game/GameFilter";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist } from "@shared/interfaces";
import { ErrorCopy } from "../util/misc";

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

export type LoadPlatformError = ErrorCopy & {
    /** File path of the platform file the error is related to. */
    filePath: string;
};

export type ThumbnailList = {
    [key: string]: string;
};