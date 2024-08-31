import {
    IAdditionalApplicationInfo,
    IGameCollection,
    IGameInfo,
} from "./interfaces";

export class GameCollection implements IGameCollection {
    public games: IGameInfo[] = [];
    public addApps: IAdditionalApplicationInfo[] = [];

    /**
     * Find the first game with a given id (returns undefined if not found)
     * @param gameId ID of game
     * @returns Game with given id (or undefined if not found)
     */
    public findGame(gameId: string): IGameInfo | undefined {
        return this.games[this.indexOfGame(gameId)];
    }

    /**
     * Find the first additional application with a given id (returns undefined if not found)
     * @param addAppId ID of additional application
     * @returns Additional application with given id (or undefined if not found)
     */
    public findAddApps(
        addAppId: string
    ): IAdditionalApplicationInfo | undefined {
        return this.addApps[this.indexOfAddApps(addAppId)];
    }

    /**
     * Find the index of the first game with a given id (-1 if not found)
     * @param gameId ID of game
     * @returns Index of game
     */
    public indexOfGame(gameId: string): number {
        const games = this.games;
        for (let i = games.length - 1; i >= 0; i--) {
            if (games[i].id === gameId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find the index of the first additional application with a given id (-1 if not found)
     * @param addAppId ID of additional application
     * @returns Index of additional application
     */
    public indexOfAddApps(addAppId: string): number {
        const addApps = this.addApps;
        for (let i = addApps.length - 1; i >= 0; i--) {
            if (addApps[i].id === addAppId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Push all data from another collection to this collection.
     * Objects are NOT copied, so both collections will have references to
     * shared objects (should probably only be used if the other collection
     * will be discarded after calling this)
     */
    public push(collection: IGameCollection): GameCollection {
        Array.prototype.push.apply(this.games, collection.games);
        Array.prototype.push.apply(this.addApps, collection.addApps);
        return this;
    }

    /** Empty the collection */
    public clear() {
        this.games.splice(0, this.games.length);
        this.addApps.splice(0, this.addApps.length);
    }

    /**
     * Find all additional applications with a given gameId
     * @param gameId gameId to find all additional applications with
     */
    public findAddAppsByGameId(gameId: string): IAdditionalApplicationInfo[] {
        const addApps: IAdditionalApplicationInfo[] = [];
        for (let i = this.addApps.length - 1; i >= 0; i--) {
            if (this.addApps[i].gameId === gameId) {
                addApps.push(this.addApps[i]);
            }
        }
        return addApps;
    }

    public forRedux(): IGameCollection {
        return {
            games: this.games,
            addApps: this.addApps,
        };
    }
}
