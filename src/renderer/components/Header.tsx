import { englishTranslation } from "@renderer/lang/en";
import { getLibraryItemTitle } from "@shared/library/util";
import * as React from "react";
import { Link, Routes, useNavigate } from "react-router-dom";
import { Paths } from "../Paths";
import { joinLibraryRoute, openContextMenu } from "../Util";
import { WithPreferencesProps } from "../containers/withPreferences";
import { MenuItemConstructorOptions } from "electron";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { ExodosResources } from "@renderer/util/exoResources";
import { throttle } from "@shared/utils/throttle";
import { BackIn, LaunchExodosContentData } from "@shared/back/types";

type OwnProps = {
    exodosResources: ExodosResources;
    /** Array of library routes */
    libraries: string[];
    /** Called when the left sidebar toggle button is clicked. */
    onToggleLeftSidebarClick?: () => void;
    /** Called when the right sidebar toggle button is clicked. */
    onToggleRightSidebarClick?: () => void;
};

export type HeaderProps = OwnProps & WithPreferencesProps;

export function Header(props: HeaderProps) {
    const strings = englishTranslation.app;
    const { exodosResources, libraries } = props;

    const navigate = useNavigate();

    const librariesScriptsMenu: MenuItemConstructorOptions[] = Object.entries(
        exodosResources
    ).map((er) => {
        const [label, files] = er;
        return {
            label,
            type: "submenu",
            submenu: files.map((f) =>
                f === null
                    ? {
                          type: "separator",
                      }
                    : {
                          label: f.split(".")[0].split("/").pop(),
                          click() {
                              onLaunchCommand(f);
                          },
                      }
            ),
        };
    });
    const menuButtons: MenuItemConstructorOptions[] = [
        ...librariesScriptsMenu,
        {
            type: "separator",
        },
        {
            label: "About",
            click() {
                navigate(Paths.ABOUT);
            },
        },
    ];

    return (
        <div className="header">
            {/* Header Menu */}
            <div className="header__wrap">
                <ul className="header__menu">
                    <li className="header__menu__item">
                        <a
                            className="header__menu__item__link"
                            onClick={() => openContextMenu(menuButtons)}
                        >
                            <FontAwesomeIcon icon={faBars} />
                        </a>
                    </li>
                    {libraries.map((library) => (
                        <MenuItem
                            key={library}
                            title={getLibraryItemTitle(library)}
                            link={joinLibraryRoute(library)}
                        />
                    ))}
                    <MenuItem title={strings.logs} link={Paths.LOGS} />
                </ul>
            </div>
        </div>
    );
}

/** An item in the header menu. Used as buttons to switch between tabs/pages. */
function MenuItem({ title, link }: { title: string; link: string }) {
    return (
        <li className="header__menu__item">
            <Link to={link} className="header__menu__item__link">
                {title}
            </Link>
        </li>
    );
}

export const onLaunchCommand = throttle((path: string): void => {
    window.External.back.send<LaunchExodosContentData>(BackIn.LAUNCH_COMMAND, {
        path,
    });
}, 500);
