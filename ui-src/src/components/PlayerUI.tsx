import type React from "preact/compat";
import type Player from "./Player";
import { useEffect, useRef, useState } from "preact/hooks";
import { useError } from "./error.tsx";
import type { TargetedEvent } from "preact";
import Queue from './Queue.tsx';
import FileUpload from "./FileUpload.tsx";

import './PlayerUI.scss';

interface MusicPlayerProps {
    musicPlayer: Player;
    onSearchUpdate: ((search: string) => void);
    onMusicPlayerVisible: (() => void);
    onUISwitch: (() => void);
}

export let MusicPlayer: React.FC<MusicPlayerProps> = props => {
    let { pushError } = useError();

    const progressBarRef = useRef<HTMLInputElement>(null);
    const volumeRef = useRef<HTMLInputElement>(null);

    const [state, setState] = useState({
        _time: Date.now(),
        currentTime: 0,
        durationSong: 0,

        isMusicPlayerVisible: true,
        isInteractiveMenuVisible: false,
        isQueueVisible: false,
        isSearchBarVisible: false,
        isVolumeVisible: false,
        isUploadVisible: false,

        isShuffled: false,
        isDragging: false,

        searchQuery: ""
    });

    const updateState = (key: keyof typeof state, value: any) => {
        setState(prevState => ({
            ...prevState,
            [key]: value,
        }));
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60)
            .toString()
            .padStart(2, '0');
        if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
            return '0:00';
        } else {
            return `${minutes}:${seconds}`;
        }
    };

    let handleVolumeChange = () => {
        if (volumeRef !== null && volumeRef.current !== null) {
            let volumeSelected = Number(volumeRef.current.value) / 100;
            props.musicPlayer.audioPlayer.volume = volumeSelected;
        }
    };

    const handleProgressChange = (e: TargetedEvent<HTMLInputElement, Event>) => {
        if (e.currentTarget !== null) {
            const newTime = parseFloat(e.currentTarget.value);
            props.musicPlayer.setTime(newTime);
            updateState('currentTime', newTime);
        }
    };

    useEffect(() => {
        props.onSearchUpdate("");

        let animationFrameId: number;

        const updateProgress = () => {
            const { audioPlayer, isPlaying } = props.musicPlayer;
            if (audioPlayer && isPlaying && !state.isDragging) {
                updateState('_time', Date.now());
                updateState('currentTime', audioPlayer.currentTime);
                updateState('durationSong', audioPlayer.duration);

                if (progressBarRef.current && audioPlayer.duration) {
                    progressBarRef.current.value = audioPlayer.currentTime.toString();
                }
            }
            animationFrameId = requestAnimationFrame(updateProgress);
        };

        animationFrameId = requestAnimationFrame(updateProgress);

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <>
            <Queue player={props.musicPlayer} isVisible={state.isQueueVisible} />
            {state.isSearchBarVisible ? (
                <div className="search-bar">
                    <input type="text" className="search-bar-input" value={state.searchQuery} placeholder="search..." onInput={e => {
                        props.onSearchUpdate(e.currentTarget?.value);
                        updateState('searchQuery', e.currentTarget?.value)
                    }} />
                </div>
            ) : null}

            {state.isUploadVisible ? (
                <div className="upload-wrapper">
                    <div className="upload-content">
                        <FileUpload endpoint="/music/upload" onComplete={(resp) => pushError(resp.status, true)} onError={(err) => pushError(err.message)} buildFormData={(file: File) => {
                            const form = new FormData();
                            form.append("file", file, file.name);
                            return form
                        }} />
                    </div>
                </div>
            ) : null}

            {state.isMusicPlayerVisible ? (
                <div className={`music-player-container`}>
                    <div className="music-player-bar">
                        <div className="music-player-toggle-music icon-wrapper" onClick={() => props.musicPlayer.toggleSong(props.musicPlayer.currentSong.url)}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                <path d="M200-312v-336l240 168-240 168Zm320-8v-320h80v320h-80Zm160 0v-320h80v320h-80Z" />
                            </svg>
                        </div>
                        <div className="music-player-progress-bar">
                            <div className="icon-wrapper" onClick={() => props.musicPlayer.playPreviousSong()}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="M440-240 200-480l240-240 56 56-183 184 183 184-56 56Zm264 0L464-480l240-240 56 56-183 184 183 184-56 56Z" />
                                </svg>
                            </div>
                            <span>{formatTime(state.currentTime)}</span>
                            <input className="music-player-progress-bar-input"
                                type="range"
                                ref={progressBarRef}
                                defaultValue="0"
                                min={0}
                                max={state.durationSong || 0}
                                step={0.01}
                                value={state.currentTime || 0}
                                onMouseDown={() => updateState('isDragging', true)}
                                onMouseUp={() => updateState('isDragging', false)}
                                onInput={handleProgressChange} />
                            <span>{formatTime(state.durationSong)}</span>
                            <div className="icon-wrapper" onClick={() => props.musicPlayer.playNextSong()}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="M383-480 200-664l56-56 240 240-240 240-56-56 183-184Zm264 0L464-664l56-56 240 240-240 240-56-56 183-184Z" />
                                </svg>
                            </div>
                        </div>
                        <div className={`interactive-menu ${state.isInteractiveMenuVisible ? 'active' : ''}`}>
                            <div className="icon-wrapper" onClick={() => updateState('isVolumeVisible', !state.isVolumeVisible)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z" />
                                </svg>
                            </div>
                            {state.isShuffled ? (
                                <div className="icon-wrapper" onClick={() => {
                                    props.musicPlayer.shuffle = false
                                    updateState('isShuffled', false)
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960" >
                                        <path d="M120-40q-33 0-56.5-23.5T40-120v-720q0-33 23.5-56.5T120-920h720q33 0 56.5 23.5T920-840v720q0 33-23.5 56.5T840-40H120Zm440-120h240v-240h-80v102L594-424l-57 57 127 127H560v80Zm-344 0 504-504v104h80v-240H560v80h104L160-216l56 56Zm151-377 56-56-207-207-56 56 207 207Z" />
                                    </svg>
                                </div>
                            ) : (
                                <div className="icon-wrapper" onClick={() => {
                                    props.musicPlayer.shuffle = true;
                                    props.musicPlayer.shuffleQueue();
                                    updateState('isShuffled', true)
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                        <path d="M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z" />
                                    </svg>
                                </div>
                            )}
                            <div className="icon-wrapper" onClick={() => updateState('isSearchBarVisible', !state.isSearchBarVisible)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" /></svg>
                            </div>
                            <div className="icon-wrapper" onClick={() => updateState('isQueueVisible', !state.isQueueVisible)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="m780-60-60-60 120-120-120-120 60-60 180 180L780-60Zm-460-60v-80H160q-33 0-56.5-23.5T80-280v-480q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v280h-80v-280H160v480h520v80h-80v80H320Zm120-240h80v-120h120v-80H520v-120h-80v120H320v80h120v120Zm-280 80v-480 480Z" />
                                </svg>
                            </div>
                            <div className="icon-wrapper" onClick={() => updateState('isUploadVisible', !state.isUploadVisible)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                                </svg>
                            </div>
                            <div className="icon-wrapper" onClick={() => {
                                props.onUISwitch()
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                    <path d="M600-80q-127-48-203.5-158T320-484q0-91 36-172.5T458-800H320v-80h280v280h-80v-148q-57 51-88.5 119.5T400-484q0 102 54 187.5T600-167v87Z" />
                                </svg>
                            </div>
                        </div>
                        <div
                            className="icon-wrapper"
                            onClick={() => updateState('isInteractiveMenuVisible', !state.isInteractiveMenuVisible)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
                            </svg>
                        </div>
                        <div className="icon-wrapper" onClick={() => {
                            updateState('isMusicPlayerVisible', false)
                            props.onMusicPlayerVisible();
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                                <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
                            </svg>
                        </div>
                    </div>
                    {state.isVolumeVisible ? (
                        <div className="volume-slider-wrapper">
                            <input
                                type="range"
                                className="volume-slider"
                                ref={volumeRef}
                                defaultValue={(props.musicPlayer.audioPlayer.volume * 100).toString()}
                                onChange={handleVolumeChange}
                            />
                        </div>
                    ) : null}
                </div>
            ) : (
                <div
                    style={{
                        backgroundColor: 'transparent',
                        zIndex: '1000',
                        position: 'fixed',
                        bottom: '0',
                        right: '0.25em',
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        updateState('isMusicPlayerVisible', true);
                        props.onMusicPlayerVisible();
                    }}
                >
                    {/* <KeyboardArrowUpIcon style={bgColor} /> */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon-size" viewBox="0 -960 960 960">
                        <path d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z" />
                    </svg>
                </div>
            )}
        </>
    )
}
