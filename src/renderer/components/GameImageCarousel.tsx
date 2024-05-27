import { fixSlashes, getFileServerURL } from "@shared/Util";
import { GameImages, IGameInfo } from "@shared/game/interfaces"
import { useMemo, useState, useCallback } from "react";
import React = require("react");
import { OpenIcon } from "./OpenIcon";

export type GameImageCarouselProps = {
    images: GameImages;
    platform: string;
    key: string; // Ensures previous images are always replaced when the selected game changes
    onScreenshotClick: (screenshotUrl: string) => void;
}

const IMAGE_COUNT = 4;

export function GameImageCarousel(props: GameImageCarouselProps) {
    const [selectedImageIdx, setSelectedImageIdx] = useState(0);
    const [wheelPosition, setWheelPosition] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

    // When the image changes, reset the selected elements
    React.useEffect(() => {
        setWheelPosition(0);
        setSelectedImageIdx(0);
    }, [props.images]);

    const sortedImages = useMemo(() => {
        return sortGameImages(props.images, props.platform)
    }, [props.images, props.platform]);

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
        if (wheelPosition < sortedImages.length - IMAGE_COUNT) {
            setWheelPosition(wheelPosition + 1);
        }
    };

    const imagePreviews = useMemo(() => {
        return sortedImages
            .slice(Math.min(wheelPosition, sortedImages.length - 1), Math.min(wheelPosition + IMAGE_COUNT, sortedImages.length))
            .map((image, idx) => {
                const selected = (wheelPosition + idx) === selectedImageIdx;

                return (
                    <div 
                        key={`${props.key}-${idx}`} 
                        style={{
                            width: `${(1 / IMAGE_COUNT) * (100 - (IMAGE_COUNT * 2))}%`,
                            marginLeft: '1%',
                            marginRight: '1%'
                        }}
                        className={`game-image-carousel-wheel-preview ${selected && 'game-image-carousel-wheel-preview--selected'}`} 
                        onMouseEnter={() => handleMouseEnter(idx)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => setSelectedImageIdx(idx + wheelPosition)}>
                        <img className="fill-image" src={`${getFileServerURL()}/Images/${image.path}`} />
                    </div>
                );
            });
    }, [wheelPosition, sortedImages, selectedImageIdx]);

    if (sortedImages.length === 0 || wheelPosition > sortedImages.length - 1|| selectedImageIdx > sortedImages.length - 1) {
        return <></>; // Either no images, or the game just changed and state needs reset, let render happen at next state change instead
    }

    const selectedImage = sortedImages[selectedImageIdx];

    console.log(selectedImage.path);
    return (
        <div className="game-image-carousel">
            <div className="game-image-carousel-selected">
                <img
                    key={props.key}
                    className="fill-image" src={`${getFileServerURL()}/Images/${selectedImage.path}`}
                    onClick={() => props.onScreenshotClick(`${getFileServerURL()}/Images/${selectedImage.path}`)}/>
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
                {wheelPosition < sortedImages.length - IMAGE_COUNT && (
                    <div className="game-image-carousel-wheel-arrow" onClick={wheelMoveRight}>
                        <OpenIcon icon="arrow-right"/>
                    </div>
                )}
            </div>
            <div className="game-image-carousel-label">
                {hoveredIndex === null ? selectedImage.name : sortedImages[hoveredIndex].name}
            </div>
        </div>
    );
}

type FormattedGameImage = {
    name: string;
    path: string;
}

function sortGameImages(images: GameImages, platform: string): FormattedGameImage[] {
    const list: FormattedGameImage[] = [];

    for (const category of Object.keys(images)) {
        for (const filename of images[category]) {
            list.push({
                name: category,
                path: fixSlashes(`${platform}/${filename}`)
            })
        }
    }

    return list;
}