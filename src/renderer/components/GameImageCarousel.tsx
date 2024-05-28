import { fixSlashes, getFileServerURL } from "@shared/Util";
import { GameImages, GameMedia, IGameInfo } from "@shared/game/interfaces"
import { useMemo, useState, useCallback } from "react";
import React = require("react");
import { OpenIcon } from "./OpenIcon";

export type GameImageCarouselProps = {
    media: GameMedia;
    platform: string;
    imgKey: string; // Ensures previous images are always replaced when the selected game changes
    onPreviewMedia: (media: FormattedGameMedia) => void;
}

const IMAGE_COUNT = 4;

export function GameImageCarousel(props: GameImageCarouselProps) {
    const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
    const [wheelPosition, setWheelPosition] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

    // When the image changes, reset the selected elements
    React.useEffect(() => {
        setWheelPosition(0);
        setSelectedMediaIdx(0);
    }, [props.media]);

    const sortedMedia = useMemo(() => {
        return sortGameMedia(props.media, props.platform)
    }, [props.media, props.platform]);

    // Hover functions to trigger the label to show
    const handleMouseEnter = (index: number) => {
        setHoveredIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    // Wheel arrow functions
    const wheelMoveLeft = () => {
        if (wheelPosition > 0) {
            setWheelPosition(wheelPosition - 1);
        }
    };

    const wheelMoveRight = () => {
        if (wheelPosition < sortedMedia.length - IMAGE_COUNT) {
            setWheelPosition(wheelPosition + 1);
        }
    };

    const imagePreviews = useMemo(() => {
        return sortedMedia
            .slice(Math.min(wheelPosition, sortedMedia.length - 1), Math.min(wheelPosition + IMAGE_COUNT, sortedMedia.length))
            .map((media, idx) => {
                const selected = (wheelPosition + idx) === selectedMediaIdx;

                let innerElem = undefined;
                switch (media.type) {
                    case FormattedGameMediaType.IMAGE: 
                        innerElem = (
                            <img
                                key={props.imgKey}
                                className="fill-image" 
                                src={`${getFileServerURL()}/${media.path}`} />
                        );
                        break;
                    case FormattedGameMediaType.VIDEO:
                        innerElem = (
                            <video
                                key={props.imgKey}
                                className="fill-image"
                                muted
                                src={`${getFileServerURL()}/${media.path}#t=0.1`} />
                        );
                        break;
                }

                return (
                    <div 
                        key={`${props.imgKey}-${idx}`} 
                        style={{
                            width: `${(1 / IMAGE_COUNT) * (100 - (IMAGE_COUNT * 2))}%`,
                            marginLeft: '1%',
                            marginRight: '1%'
                        }}
                        className={`game-image-carousel-wheel-preview ${selected && 'game-image-carousel-wheel-preview--selected'}`} 
                        onMouseEnter={() => handleMouseEnter(idx)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => setSelectedMediaIdx(idx + wheelPosition)}>
                        {innerElem}
                    </div>
                );
            });
    }, [wheelPosition, sortedMedia, selectedMediaIdx]);

    if (sortedMedia.length === 0 || wheelPosition > sortedMedia.length - 1 || selectedMediaIdx > sortedMedia.length - 1) {
        return <></>; // Either no images, or the game just changed and state needs reset, let render happen at next state change instead
    }

    const selectedMedia = sortedMedia[selectedMediaIdx];

    const renderSelected = () => {
        switch (selectedMedia.type) {
            case FormattedGameMediaType.IMAGE: 
                return (
                    <img
                        key={props.imgKey}
                        className="fill-image" 
                        src={`${getFileServerURL()}/${selectedMedia.path}`}
                        onClick={() => props.onPreviewMedia(selectedMedia)}/>
                )
            case FormattedGameMediaType.VIDEO:
                return (
                    <video
                        key={props.imgKey}
                        className="fill-image" 
                        autoPlay
                        loop
                        muted
                        src={`${getFileServerURL()}/${selectedMedia.path}`}
                        onClick={() => props.onPreviewMedia(selectedMedia)}/>
                )
        }
    };

    return (
        <div className="game-image-carousel">
            <div className="game-image-carousel-selected">
                {renderSelected()}
            </div>
            <div className="game-image-carousel-wheel">
                {wheelPosition > 0 && (
                    <div className="game-image-carousel-wheel-arrow" onClick={wheelMoveLeft}>
                        <OpenIcon icon="arrow-left"/>
                    </div>
                )}
                <div className="game-image-carousel-wheel-previews">
                    {imagePreviews}
                </div>
                {wheelPosition < sortedMedia.length - IMAGE_COUNT && (
                    <div className="game-image-carousel-wheel-arrow" onClick={wheelMoveRight}>
                        <OpenIcon icon="arrow-right"/>
                    </div>
                )}
            </div>
            <div className="game-image-carousel-label">
                {hoveredIndex === null ? selectedMedia.name : sortedMedia[hoveredIndex].name}
            </div>
        </div>
    );
}

export enum FormattedGameMediaType {
    IMAGE,
    VIDEO,
}

export type FormattedGameMedia = {
    name: string;
    type: FormattedGameMediaType;
    path: string;
}

function sortGameMedia(media: GameMedia, platform: string): FormattedGameMedia[] {
    const list: FormattedGameMedia[] = [];

    // Add videos first
    if (media.video) {
        console.log('VIDEO');
        list.push({
            name: "30 Second Demo",
            type: FormattedGameMediaType.VIDEO,
            path: fixSlashes(media.video),
        })
    }

    // Add images next
    for (const category of Object.keys(media.images)) {
        for (const filename of media.images[category]) {
            list.push({
                name: category,
                type: FormattedGameMediaType.IMAGE,
                path: fixSlashes(`Images/${platform}/${filename}`),
            })
        }
    }

    return list;
}