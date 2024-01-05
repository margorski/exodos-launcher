import { AppUpdater, UpdateInfo } from "electron-updater";
import * as React from "react";
import { Route, Switch } from "react-router-dom";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import {
    ExodosBackendInfo,
    GamePlaylist,
    GamePropSuggestions,
} from "@shared/interfaces";
import { LangFile } from "@shared/lang";
import { Theme } from "@shared/ThemeFile";
import { GameOrderChangeEvent } from "./components/GameOrder";
import { AboutPage } from "./components/pages/AboutPage";
import {
    DeveloperPage,
    DeveloperPageProps,
} from "./components/pages/DeveloperPage";
import { NotFoundPage } from "./components/pages/NotFoundPage";
import ConnectedBrowsePage, {
    ConnectedBrowsePageProps,
} from "./containers/ConnectedBrowsePage";
import {
    ConnectedConfigPage,
    ConnectedConfigPageProps,
} from "./containers/ConnectedConfigPage";
import {
    ConnectedHomePage,
    ConnectedHomePageProps,
} from "./containers/ConnectedHomePage";
import { ConnectedLogsPage } from "./containers/ConnectedLogsPage";
import { GAMES } from "./interfaces";
import { Paths } from "./Paths";

export type AppRouterProps = {
    games: GAMES | undefined;
    gamesTotal: number;
    playlists: GamePlaylist[];
    suggestions: Partial<GamePropSuggestions>;
    appPaths: Record<string, string>;
    platforms: Record<string, string[]>;
    platformsFlat: string[];
    onSaveGame: (
        game: IGameInfo,
        addApps: IAdditionalApplicationInfo[] | undefined,
        playlistNotes: string | undefined,
        saveToFile: boolean,
    ) => void;
    onLaunchGame: (gameId: string) => void;
    onRequestGames: (start: number, end: number) => void;
    onQuickSearch: (search: string) => void;
    playlistIconCache: Record<string, string>;
    libraries: string[];
    localeCode: string;

    order?: GameOrderChangeEvent;
    gameScale: number;
    gameLayout: BrowsePageLayout;
    selectedGameId?: string;
    selectedPlaylistId?: string;
    onSelectGame: (gameId?: string) => void;
    onSelectPlaylist: (library: string, playlistId: string | undefined) => void;
    wasNewGameClicked: boolean;
    gameLibrary: string;
    themeList: Theme[];
    languages: LangFile[];
    updateInfo: UpdateInfo | undefined;
    exodosBackendInfo: ExodosBackendInfo | undefined;
};

export class AppRouter extends React.Component<AppRouterProps> {
    render() {
        const homeProps: ConnectedHomePageProps = {
            platforms: this.props.platforms,
            playlists: this.props.playlists,
            exodosBackendInfo: this.props.exodosBackendInfo,
            onSelectPlaylist: this.props.onSelectPlaylist,
            onLaunchGame: this.props.onLaunchGame,
            updateInfo: this.props.updateInfo,
        };
        const browseProps: ConnectedBrowsePageProps = {
            games: this.props.games,
            gamesTotal: this.props.gamesTotal,
            playlists: this.props.playlists,
            suggestions: this.props.suggestions,
            playlistIconCache: this.props.playlistIconCache,
            onSaveGame: this.props.onSaveGame,
            onRequestGames: this.props.onRequestGames,
            onQuickSearch: this.props.onQuickSearch,

            order: this.props.order,
            gameScale: this.props.gameScale,
            gameLayout: this.props.gameLayout,
            selectedGameId: this.props.selectedGameId,
            selectedPlaylistId: this.props.selectedPlaylistId,
            onSelectGame: this.props.onSelectGame,
            onSelectPlaylist: this.props.onSelectPlaylist,
            wasNewGameClicked: this.props.wasNewGameClicked,
            gameLibrary: this.props.gameLibrary,
        };
        const configProps: ConnectedConfigPageProps = {
            themeList: this.props.themeList,
            availableLangs: this.props.languages,
            platforms: this.props.platformsFlat,
            localeCode: this.props.localeCode,
        };
        const developerProps: DeveloperPageProps = {
            platforms: this.props.platformsFlat,
            playlists: this.props.playlists,
        };
        return (
            <Switch>
                <PropsRoute
                    exact
                    path={Paths.HOME}
                    component={ConnectedHomePage}
                    {...homeProps}
                />
                <PropsRoute
                    path={Paths.BROWSE}
                    component={ConnectedBrowsePage}
                    {...browseProps}
                />
                <PropsRoute path={Paths.LOGS} component={ConnectedLogsPage} />
                <PropsRoute
                    path={Paths.CONFIG}
                    component={ConnectedConfigPage}
                    {...configProps}
                />
                <PropsRoute path={Paths.ABOUT} component={AboutPage} />
                <PropsRoute
                    path={Paths.DEVELOPER}
                    component={DeveloperPage}
                    {...developerProps}
                />
                <Route component={NotFoundPage} />
            </Switch>
        );
    }
}

/** Reusable way to pass properties down a router and to its component. */
const PropsRoute = ({ component, ...rest }: any) => (
    <Route
        {...rest}
        render={(routeProps) => renderMergedProps(component, routeProps, rest)}
    />
);

function renderMergedProps(component: any, ...rest: any[]) {
    const finalProps = Object.assign({}, ...rest);
    return React.createElement(component, finalProps);
}
