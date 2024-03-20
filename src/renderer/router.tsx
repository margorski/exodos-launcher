import { UpdateInfo } from "electron-updater";
import * as React from "react";
import { Route, Routes } from "react-router-dom";
import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { ExodosBackendInfo, GamePlaylist } from "@shared/interfaces";
import { Theme } from "@shared/ThemeFile";
import { GameOrderChangeEvent } from "./components/GameOrder";
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
    appPaths: Record<string, string>;
    platforms: Record<string, string[]>;
    platformsFlat: string[];
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
            playlistIconCache: this.props.playlistIconCache,
            onRequestGames: this.props.onRequestGames,
            onQuickSearch: this.props.onQuickSearch,
            order: this.props.order,
            gameScale: this.props.gameScale,
            gameLayout: this.props.gameLayout,
            selectedGameId: this.props.selectedGameId,
            selectedPlaylistId: this.props.selectedPlaylistId,
            onSelectGame: this.props.onSelectGame,
            onSelectPlaylist: this.props.onSelectPlaylist,
            gameLibrary: this.props.gameLibrary,
        };
        const configProps: ConnectedConfigPageProps = {
            themeList: this.props.themeList,
            platforms: this.props.platformsFlat,
            localeCode: this.props.localeCode,
        };
        return (
            <Routes>
                <Route
                    path={Paths.HOME}
                    element={<ConnectedHomePage {...homeProps} />}
                />
                <Route
                    path={Paths.BROWSE}
                    element={<ConnectedBrowsePage {...browseProps} />}
                />
                <Route path={Paths.LOGS} element={<ConnectedLogsPage />} />
                <Route
                    path={Paths.CONFIG}
                    element={<ConnectedConfigPage {...configProps} />}
                />
                <Route Component={NotFoundPage} />
            </Routes>
        );
    }
}
