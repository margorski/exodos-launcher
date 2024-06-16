import { GameCollection } from "@shared/game/GameCollection";
import { IAdditionalApplicationInfo } from "@shared/game/interfaces";

export function getPlatforms(collection: GameCollection): string[] {
    // Get the values from the game collection
    const map: { [key: string]: true } = {};
    for (let key in collection.games) {
        const game = collection.games[key];
        getGamePropValues(map, game.platform);
    }
    // Create a more usable object to store the values in
    const plat: string[] = Object.keys(map)
        .filter((val) => val !== "")
        .sort();
    return plat;
}

function getGamePropValues(dict: { [key: string]: true }, value: string) {
    if (value.indexOf(";") >= 0) {
        // (Multiple values)
        const values = value.split(";");
        for (let v of values) {
            dict[v.trim()] = true;
        }
    } else {
        // (Single value)
        dict[value] = true;
    }
}
