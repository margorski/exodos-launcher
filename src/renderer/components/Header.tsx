import { englishTranslation } from "@renderer/lang/en";
import { setSearchText } from "@renderer/redux/searchSlice";
import { RootState } from "@renderer/redux/store";
import { getLibraryItemTitle } from "@shared/library/util";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Paths } from "../Paths";
import { joinLibraryRoute } from "../Util";
import { WithPreferencesProps } from "../containers/withPreferences";
import { GameOrder, GameOrderChangeEvent } from "./GameOrder";
import { OpenIcon } from "./OpenIcon";

type OwnProps = {
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
    const { libraries } = props;

    return (
        <div className="header">
            {/* Header Menu */}
            <div className="header__wrap">
                <ul className="header__menu">
                    <MenuItem title={strings.home} link={Paths.HOME} />
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
