import '../scss/MusicPlayer.scss'
import React, { useEffect, useRef, useState } from 'preact/compat'
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import Cookies from 'js-cookie';
import axios from 'axios';
import { hostname } from './global';
import Player from './damusiccontrol/musicplayer';

let bgColor: React.JSX.CSSProperties = {backgroundColor: "#4D566F"}

export type musicFile = {
    id: number;
    createdAt: string;
    updatedAt: string;
    fileName: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    url: string;
    ownerUsername?: string;
}

export type QueueType = {
    id: number,
    file: string,
    object: musicFile
}

interface MusicPlayerProps {
    isDownloadOverlayVisible: boolean
    isUploadOverlayVisible: boolean
    updateGlobalState: (key: "isDownloadOverlayVisible" | "isUploadOverlayVisible" | "updatetofixsumbrokenshi" | any, value: any) => void
    musicPlayer: Player
    updatetofixsumbrokenshi: boolean
}

export let MusicPlayer: React.FC<MusicPlayerProps> = (props) => {
    const progressBarRef = useRef<HTMLInputElement>(null);
    const volumeRef = useRef<HTMLInputElement>(null);

    const [state, setState] = useState({
        _time: Date.now(),
        currentTime: 0,
        durationSong: 0,
        spotifyDownloadText: "",
        fileSelected: null as File | null,
        isMusicPlayerVisible: true,
        isInteractiveMenuVisible: false,
        isUserSelectingVolume: false, 
    });

    const updateState = (key: keyof typeof state, value: any) => {
        setState(prevState => ({
            ...prevState,
            [key]: value,
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let files = e.currentTarget.files
        if (files) {
            updateState("fileSelected", files[0])
        }
    };

    let makeFileUploadRequest = async () => {
        const cookie = Cookies.get('token')
        let formData = new FormData();
        if (cookie && state.fileSelected) {
            formData.append('jwt', cookie)
            formData.append('file', state.fileSelected)
            let request = await axios.post(`${hostname}/upload`, formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                }
            })
            console.log(request.data)
        }
    }

    let handleVolumeChange = () => {
        if (volumeRef !== null && volumeRef.current !== null) {
            let volumeSelected = Number(volumeRef.current.value) / 100
            props.musicPlayer.audioPlayer.volume = volumeSelected
        }
    }

    let handleProgressChange = () => {
        if (progressBarRef !== null && progressBarRef.current !== null ) {
            let translation = props.musicPlayer.audioPlayer.duration / 100;
            const newTime = Number(progressBarRef.current.value) * translation
            props.musicPlayer.setTime(newTime)
            props.musicPlayer.audioPlayer.play()
            console.log(progressBarRef.current.value)
        }
    }

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60).toString().padStart(2, '0');
        if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
            return "0:00";
        } else {
            return `${minutes}:${seconds}`;
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            updateState("_time", Date.now())
            updateState("currentTime", props.musicPlayer.audioPlayer.currentTime)
            updateState("durationSong", props.musicPlayer.audioPlayer.duration)
            if (props.musicPlayer.isPlaying != false) {
                // console.log(props.musicPlayer.currentAudioPlayer.currentTime)
                if (props.musicPlayer.audioPlayer.currentTime && progressBarRef.current) {
                    let translation = props.musicPlayer.audioPlayer.duration / 100;
                    progressBarRef.current.value = (props.musicPlayer.audioPlayer.currentTime / translation).toString();
                    // console.log(progressBarRef.current.value)
                }
            }
        }, 1000);
        return () => {
            clearInterval(interval);
        };
        // console.log(props.musicPlayer.currentAudioPlayer.currentTime)
    },[])

    return (
        <div>
            {state.isMusicPlayerVisible ? (
                <div className={`music-player-container`}>
                    <div className="music-player-bar">
                        <div class="music-player-pause-button" onClick={() => props.musicPlayer.audioPlayer.pause()}>
                            <PauseIcon style={bgColor} />
                        </div>
                        <div class="music-player-play-button" onClick={() => props.musicPlayer.audioPlayer.play()}>
                            <PlayArrow style={bgColor} />
                        </div>
                        {/* <div style={{width: '100px'}}></div> */}
                        <div className="music-player-progress-bar">
                            <FastRewindIcon style={{backgroundColor: "transparent", cursor: "pointer"}} onClick={() => {
                                props.musicPlayer.playPreviousSong()
                            }}/>
                            <span>{formatTime(state.currentTime)}</span>
                            <input className="music-player-progress-bar-input" 
                                type="range" ref={progressBarRef} defaultValue="0" 
                                onChange={handleProgressChange} />
                            <span>{formatTime(state.durationSong)}</span>
                            <FastForwardIcon style={{backgroundColor: "transparent", cursor: "pointer"}} onClick={() => {
                                props.musicPlayer.playNextSong()
                            }}/>
                        </div>
                        {state.isInteractiveMenuVisible ? (
                            <>
                                {/* <div style={{backgroundColor: "transparent", height: "1.5em", cursor: "pointer"}} onClick={() => updateState("isUploadOverlayVisible", true)}>
                                    <FileUploadIcon style={bgColor} />
                                </div>
                                <div class="music-player-download-button" onClick={(() => updateState("isDownloadOverlayVisible", !state.isDownloadOverlayVisible))}>
                                    <DownloadIcon style={bgColor} />
                                </div> */}
                                <VolumeUpIcon style={{backgroundColor: "transparent", cursor: "pointer"}} onClick={() => {
                                    updateState("isUserSelectingVolume", !state.isUserSelectingVolume)
                                }}/>
                                <ShuffleIcon style={{backgroundColor: "transparent", cursor: "pointer"}} onClick={() => {
                                    props.musicPlayer.shuffle = !props.musicPlayer.shuffle
                                    props.updateGlobalState('updatetofixsumbrokenshi', !props.updatetofixsumbrokenshi)
                                }}/>
                                {state.isUserSelectingVolume ? (
                                    <div className="volume-slider-wrapper">
                                        <input type="range" className="volume-slider" ref={volumeRef} 
                                            defaultValue={(props.musicPlayer.audioPlayer.volume * 100).toString()}
                                            onChange={handleVolumeChange}
                                            />
                                    </div>
                                ) : null}
                            </>
                        ) : (<></>)}
                        <div style={{backgroundColor: "transparent", height: "1.5em", cursor: "pointer"}} onClick={() => updateState("isInteractiveMenuVisible", !state.isInteractiveMenuVisible)}>
                            <MoreVertIcon style={bgColor} size={0.75}/>
                        </div>
                        <div style={{backgroundColor: "transparent", height: "1.5em", cursor: "pointer"}} onClick={() => updateState("isMusicPlayerVisible", false)}>
                            <KeyboardArrowDownIcon style={bgColor} />
                        </div>
                    </div>
                    {props.isUploadOverlayVisible && (
                        <div className="music-upload-overlay">
                            <div className="music-upload-content">
                                <span>upload file to server</span>
                                <input type="file" onChange={handleFileChange} />
                                <button onClick={async () => await makeFileUploadRequest()}>submit</button>
                            </div>
                        </div>
                    )}
                    {props.isDownloadOverlayVisible && (
                        <div className="music-downloader-overlay">
                            <div className="music-downloader-content">
                                <span>enter spotify link</span>
                                <input placeholder="https://open.spotify.com/"onInput={e => updateState("spotifyDownloadText" ,e.currentTarget.value)}/>
                                <button onClick={async () => {
                                    const cookie = Cookies.get('token');
                                    let request = await axios.post(`${hostname}/download/spotify`, `jwt=${cookie}&url=${state.spotifyDownloadText}`)
                                    console.log(request.data)
                                }}>download</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    backgroundColor: "transparent",
                    zIndex: "1000",
                    position: "fixed",
                    bottom: 0,
                    right: "0.25em",
                    cursor: "pointer"
                }} onClick={() => updateState("isMusicPlayerVisible", true)}>
                    <KeyboardArrowUpIcon style={bgColor} />
                </div>
            )}
        </div>
    )
}