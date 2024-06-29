import * as React from "react";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { englishTranslation } from "@renderer/lang/en";

export type GameOrderProps = {
    onChangeOrderBy: (value: GameOrderBy) => void;
    onChangeOrderReverse: (value: GameOrderReverse) => void;
    /** What property to order the games by. */
    orderBy: GameOrderBy;
    /** What way to order the games in. */
    orderReverse: GameOrderReverse;
};

/** Object emitted when the game order changes. */
export type GameOrderChangeEvent = {
    orderBy: GameOrderBy;
    orderReverse: GameOrderReverse;
};

export interface GameOrder {
}

/**
 * Two drop down lists, the first for selecting what to order the games by, and
 * the second for selecting what way to order the games in.
 */
export class GameOrder extends React.Component<GameOrderProps> {
    render() {
        const strings = englishTranslation.filter;
        return (
            <>
                {/* Order By */}
                <select
                    className="simple-selector search-bar-order-dropdown"
                    value={this.props.orderBy}
                    onChange={this.onOrderByChange}
                >
                    <option value="title">{strings.title}</option>
                    <option value="releaseYear">{strings.releaseDate}</option>
                    <option value="developer">{strings.developer}</option>
                    <option value="publisher">{strings.publisher}</option>
                    <option value="tags">{strings.tags}</option>
                </select>
                {/* Order Reverse */}
                <select
                    className="simple-selector search-bar-order-dropdown"
                    value={this.props.orderReverse}
                    onChange={this.onOrderReverseChange}
                >
                    <option value="ascending">{strings.ascending}</option>
                    <option value="descending">{strings.descending}</option>
                </select>
            </>
        );
    }

    onOrderByChange = (
        event: React.ChangeEvent<HTMLSelectElement>,
    ): void => {
        try {
            const orderBy = validateOrderBy(event.target.value);
            this.props.onChangeOrderBy(orderBy);
        } catch (error) {
            console.log('Failed to update order by: ' + error);
        }
    };

    onOrderReverseChange = (
        event: React.ChangeEvent<HTMLSelectElement>,
    ): void => {
        try {
            const orderReverse = validateOrderReverse(event.target.value);
            this.props.onChangeOrderReverse(orderReverse);
        } catch (error) {
            console.log('Failed to update order reverse: ' + error);
        }
    };
}

/**
 * Validate a value to be a "GameOrderBy" string (throws an error if invalid).
 * @param value Value to validate.
 * @returns The same value as the first argument.
 */
function validateOrderBy(value: string): GameOrderBy {
    switch (value) {
        case "releaseYear":
            return "releaseYear";
        case "dateAdded":
            return "dateAdded";
        case "tags":
            return "tags";
        case "platform":
            return "platform";
        case "series":
            return "series";
        case "title":
            return "title";
        case "developer":
            return "developer";
        case "publisher":
            return "publisher";
        default:
            throw new Error(`"${value}" is not a valid GameOrderBy`);
    }
}

/**
 * Validate a value to be a "GameOrderReverse" string (throws an error if invalid).
 * @param value Value to validate.
 * @returns The same value as the first argument.
 */
function validateOrderReverse(value: string): GameOrderReverse {
    switch (value) {
        case "ascending":
            return "ascending";
        case "descending":
            return "descending";
        default:
            throw new Error(`"${value}" is not a valid GameOrderReverse`);
    }
}
