import * as React from "react";

export type SplashScreenProps = {
    gamesLoaded: boolean;
    playlistsLoaded: boolean;
    miscLoaded: boolean;
};

export function SplashScreen(props: SplashScreenProps) {
    const { gamesLoaded, playlistsLoaded, miscLoaded } = props;
    const extraClass =
        gamesLoaded && playlistsLoaded && miscLoaded
            ? " splash-screen--fade-out"
            : "";
    return (
        <div className={"splash-screen" + extraClass}>
            <div className="splash-screen__logo fp-logo-box">
                <div className="exo-logo" />
            </div>
            <div className="splash-screen__status-block">
                <div className="splash-screen__status-header">Loading</div>
                {!gamesLoaded ? (
                    <div className="splash-screen__status">Games</div>
                ) : undefined}
                {!playlistsLoaded ? (
                    <div className="splash-screen__status">Playlists</div>
                ) : undefined}
                {!miscLoaded ? (
                    <div className="splash-screen__status">Misc</div>
                ) : undefined}
            </div>
        </div>
    );
}
