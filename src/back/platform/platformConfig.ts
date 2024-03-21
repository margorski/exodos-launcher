export interface IPlatformConfig {
    // field is used to map platform with config
    filename: string;
    // gamesPlaylists indicate main platform for game and it force backend
    // to include into playlists installed games playlist and add all other
    // playlists.
    gamesPlatform: boolean;
    gamesSubdirectory: string;
}

// configs are m
export const platformConfigs: IPlatformConfig[] = [
    {
        filename: "MS-DOS",
        gamesPlatform: true,
        gamesSubdirectory: "eXoDOS",
    },
    {
        filename: "DREAMM",
        gamesPlatform: true,
        gamesSubdirectory: "eXoDREAMM",
    },
];
