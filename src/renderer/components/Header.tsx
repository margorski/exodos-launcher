import * as React from "react";
import { Link } from "react-router-dom";
import { getLibraryItemTitle } from "@shared/library/util";
import { WithPreferencesProps } from "../containers/withPreferences";
import { Paths } from "../Paths";
import { SearchQuery } from "../store/search";
import { joinLibraryRoute } from "../Util";
import { GameOrder, GameOrderChangeEvent } from "./GameOrder";
import { OpenIcon } from "./OpenIcon";
import {
    DefaultGameOrderBy,
    DefaultGameOrderReverse,
} from "@shared/order/interfaces";
import { englishTranslation } from "@renderer/lang/en";

type OwnProps = {
    /** The most recent search query. */
    searchQuery: SearchQuery;
    /** The current parameters for ordering games. */
    order: GameOrderChangeEvent;
    /** Array of library routes */
    libraries: string[];
    /** Called when a search is made. */
    onSearch: (text: string, redirect: boolean) => void;
    /** Called when any of the ordering parameters are changed (by the header or a sub-component). */
    onOrderChange?: (event: GameOrderChangeEvent) => void;
    /** Called when the left sidebar toggle button is clicked. */
    onToggleLeftSidebarClick?: () => void;
    /** Called when the right sidebar toggle button is clicked. */
    onToggleRightSidebarClick?: () => void;
};

export type HeaderProps = OwnProps & WithPreferencesProps;

type HeaderState = {
    /** Current text in the search field. */
    searchText: string;
};

export interface Header {}

/** The header that is always visible at the top of the main window (just below the title bar). */
export class Header extends React.Component<HeaderProps, HeaderState> {
    searchInputRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: HeaderProps) {
        super(props);
        this.state = {
            searchText: this.props.searchQuery.text,
        };
    }

    componentDidMount() {
        window.addEventListener("keypress", this.onKeypress);
    }

    componentWillUnmount() {
        window.removeEventListener("keypress", this.onKeypress);
    }

    componentDidUpdate(prevProps: HeaderProps, prevState: HeaderState) {
        // Update the text in the text-box if the search text has changed
        const text = this.props.searchQuery.text;
        if (
            text !== prevProps.searchQuery.text &&
            text !== prevState.searchText
        ) {
            this.setState({ searchText: text });
        }
    }

    render() {
        const strings = englishTranslation.app;
        const { onOrderChange, libraries } = this.props;
        const { searchText } = this.state;

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
                                    ref={this.searchInputRef}
                                    value={searchText}
                                    placeholder={strings.searchPlaceholder}
                                    onChange={this.onSearchChange}
                                />
                            </div>
                            <div
                                className="header__search__right"
                                onClick={
                                    searchText ? this.onClearClick : undefined
                                }
                            >
                                <div className="header__search__right__inner">
                                    <OpenIcon
                                        className="header__search__icon"
                                        icon={
                                            searchText
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
                            orderBy={this.props.order.orderBy}
                            orderReverse={this.props.order.orderReverse}
                        />
                    </div>
                </div>
                <div className="header__wrap">
                    <div
                        className="simple-button"
                        onClick={() => this.onReset(onOrderChange)}
                    >
                        {strings.reset}
                    </div>
                </div>
            </div>
        );
    }

    onReset = (
        onOrderChange: ((event: GameOrderChangeEvent) => void) | undefined
    ) => {
        if (onOrderChange)
            onOrderChange({
                orderBy: DefaultGameOrderBy,
                orderReverse: DefaultGameOrderReverse,
            });
        setTimeout(this.onClearClick, 0);
    };

    onSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const value = event.target.value;
        this.setState({ searchText: value });
        this.props.onSearch(value, true);
        // "Clear" the search when the search field gets empty
        if (value === "") {
            this.props.onSearch("", false);
        }
    };

    onKeypress = (event: KeyboardEvent): void => {
        if (event.ctrlKey && event.code === "KeyF") {
            const element = this.searchInputRef.current;
            if (element) {
                element.select();
                event.preventDefault();
            }
        }
    };

    onClearClick = (): void => {
        this.setState({ searchText: "" });
        this.props.onSearch("", false);
    };
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
