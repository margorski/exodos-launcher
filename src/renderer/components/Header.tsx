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
    gameLibrary?: string;
    /** The current parameters for ordering games. */
    order: GameOrderChangeEvent;
    /** Array of library routes */
    libraries: string[];
    /** Called when any of the ordering parameters are changed (by the header or a sub-component). */
    onOrderChange?: (event: GameOrderChangeEvent) => void;
    /** Called when the left sidebar toggle button is clicked. */
    onToggleLeftSidebarClick?: () => void;
    /** Called when the right sidebar toggle button is clicked. */
    onToggleRightSidebarClick?: () => void;
};

export type HeaderProps = OwnProps & WithPreferencesProps;

export function Header(props: HeaderProps) {
    const viewName = props.gameLibrary || (props.libraries.length > 0 ? props.libraries[0] : '');
    const strings = englishTranslation.app;
    const { onOrderChange, libraries } = props;
    const searchState = useSelector((state: RootState) => state.searchState);
    const dispatch = useDispatch();
    const view = searchState.views[viewName];
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const onKeypress = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.code === "KeyF") {
            const element = searchInputRef.current;
            if (element) {
                element.select();
                event.preventDefault();
            }
        }
    };

    React.useEffect(() => {
        window.addEventListener('keypress', onKeypress);

        return () => {
            window.removeEventListener('keypress', onKeypress);
        };
    }, []);

    const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const view = props.gameLibrary || (props.libraries.length > 0 ? props.libraries[0] : '');
        if (view) {
            dispatch(setSearchText({
                view,
                text: event.currentTarget.value,
            }));
        }
    };

    const onClearClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const view = props.gameLibrary || (props.libraries.length > 0 ? props.libraries[0] : '');
        if (view) {
            dispatch(setSearchText({
                view,
                text: '',
            }));
        }
    }

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
            {/* Header Search */}
            <div className="header__wrap header__wrap--width-restricted header__search__wrap">
                <div>
                    <div className="header__search">
                        <div className="header__search__left">
                            <input
                                className="header__search__input"
                                ref={searchInputRef}
                                value={view ? view.text : ''}
                                placeholder={strings.searchPlaceholder}
                                onChange={onSearchChange}
                            />
                        </div>
                        <div
                            className="header__search__right"
                            onClick={onClearClick} >
                            <div className="header__search__right__inner">
                                <OpenIcon
                                    className="header__search__icon"
                                    icon={
                                        view && view.text
                                            ? "circle-x"
                                            : "magnifying-glass"
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Header Drop-downs */}
            <div className="header__wrap">
                <div>
                    <GameOrder
                        onChange={onOrderChange}
                        orderBy={props.order.orderBy}
                        orderReverse={props.order.orderReverse}
                    />
                </div>
            </div>
            {/* <div className="header__wrap">
                <div
                    className="simple-button"
                    onClick={() => onReset(onOrderChange)} >
                    {strings.reset}
                </div>
            </div> */}
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
