export type ICommandMapping = {
    extensions: string[];
    command: string;
    includeFilename: true;
    includeArgs: true;
};

export type IAppCommandsMappingData = {
    defaultMapping: ICommandMapping;
    commandsMapping: ICommandMapping[];
};

export const DefaultCommandMapping: ICommandMapping = {
    command: "xdg-open",
    extensions: [],
    includeArgs: true,
    includeFilename: true,
};
