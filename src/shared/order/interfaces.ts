/** Properties to order games by */
export type GameOrderBy =
    | "title"
    | "dateAdded"
    | "tags"
    | "platform"
    | "series"
    | "developer"
    | "publisher"
    | "releaseYear";
export const DefaultGameOrderBy: GameOrderBy = "title";

/** Ways to order games */
export type GameOrderReverse = "ascending" | "descending";
export const DefaultGameOrderReverse: GameOrderReverse = "ascending";
