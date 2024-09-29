import axios from "axios"
import { useState, useEffect, useRef } from "preact/hooks"
import { withAuth } from "../etc/withAuth"
import "../scss/profile/profile.scss"
import "../scss/bludclart.scss"
import "../scss/othermode.scss"
import { musicFile, MusicPlayer, QueueType } from "../etc/MusicPlayer"
import Cookies from "js-cookie"
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import FlipIcon from '@mui/icons-material/Flip';
import AddIcon from '@mui/icons-material/Add';
import QueueIcon from '@mui/icons-material/Queue';
import PlayArrow from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import RemoveIcon from '@mui/icons-material/Remove';
import { hostname } from "../etc/global"
import { Profile } from "../etc/Profile"
import Player from "../etc/damusiccontrol/musicplayer"

export let profileMenuButtonStyle: React.JSX.CSSProperties = { backgroundColor: "transparent", cursor: "pointer" }

export type UserData = {
    id: number,
    createdAt: string,
    updatedAt: string,
    username: string,
    password: string,
    musicFolder: string,
    profilePicture: string,
}

type playlistType = {
    id: number;
    title: string;
    picture: string;
    ownerUsername: string;
    songs: {
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
    }[]
}

export type State = {
    data?: musicFile[];
    userData?: UserData;
    playlists?: playlistType[];
    searchQuery: string;
    isSearchBarVisible: boolean;
    isProfileMenuVisible: boolean;
    isUploadOverlayVisible: boolean;
    isDownloadOverlayVisible: boolean;
    queue: QueueType[];
    isQueueVisible: boolean;
    graphicalMode: boolean;
    isUserAddingPlaylist: boolean;
    sumPlaylist: { 
        visible: boolean, 
        selectedPlaylist?: playlistType
    }
    newPlayListValue: string;
    updatetofixsumbrokenshi: boolean;
    songsSortOption: string;
    isUserAddingSongToPlaylist: {
        isit: boolean,
        playlist?: playlistType
    }
    isUserRemovingSongFromPlaylist: {
        isit: boolean,
        playlist?: playlistType
    }
};

let player = new Player();

let bludclartPage = () => {
    const [state, setState] = useState<State>({
        data: undefined,
        userData: undefined,
        playlists: undefined,
        searchQuery: "",
        isSearchBarVisible: false,
        isProfileMenuVisible: false,
        isDownloadOverlayVisible: false,
        isUploadOverlayVisible: false,
        queue: player.queue,
        isQueueVisible: false,
        graphicalMode: false,
        isUserAddingPlaylist: false,
        sumPlaylist: {visible: false},
        newPlayListValue: "",
        updatetofixsumbrokenshi: false,
        songsSortOption: "",
        isUserAddingSongToPlaylist: {
            isit: false
        },
        isUserRemovingSongFromPlaylist: {
            isit: false
        }
    });

    const updateState = <K extends keyof State>(key: K, value: State[K]) => {
        setState((prevState) => ({
            ...prevState,
            [key]: value,
        }));
    };

    const queueInnerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let goAndFetchDog = async () => {
            const token = Cookies.get('token')
            let res = await axios.post(`${hostname}/user/getfiles`, `jwt=${token}`)
            updateState("data", res.data)
            let bang = await axios.post(`${hostname}/user/get`, `jwt=${token}`)
            updateState("userData", bang.data.user)
            let req = await axios.post(`${hostname}/user/playlist/get`, `jwt=${token}`)
            updateState("playlists", req.data.res) 
        }
        goAndFetchDog()

        // some other init
        updateState("songsSortOption", "date last")
    }, [])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeElement = document.activeElement as HTMLElement;

            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                if (player.audioPlayer) {
                    if (player.audioPlayer.paused) {
                        player.audioPlayer.play();
                    } else {
                        player.audioPlayer.pause();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        const handleScroll = (event: WheelEvent) => {
            if (queueInnerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = queueInnerRef.current;
                const isScrollable = scrollTop !== 0 || scrollTop + clientHeight !== scrollHeight;
                if (isScrollable) {
                    event.stopPropagation();
                }
            }
        };

        const wrapper = queueInnerRef.current;
        if (wrapper) {
            wrapper.addEventListener('wheel', handleScroll);
        }

        return () => {
            if (wrapper) {
                wrapper.removeEventListener('wheel', handleScroll);
            }
        };
    }, []);

    useEffect(() => {
        player.onQueueUpdate = () => {
            updateState("queue", [...player.queue]);
        };

        return () => {
            player.onQueueUpdate = null;
        };
    }, []);

    let queueBangFraud = () => {
        updateState("searchQuery", "")
        updateState("isQueueVisible", !state.isQueueVisible)
    }

    let filteredGraphicalData = state.data?.filter(file => 
        file.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        file.artist.toLowerCase().includes(state.searchQuery.toLowerCase())
    );

    let showGraphicalData = filteredGraphicalData?.map((file) =>
        <div className="music-grid-wrapper" key={file.title}>
            <div className="music-content-wrapper">
                <div className="music-data-wrapper">
                    <div className="music-title">{file.title}</div>
                    <div className="music-artist">{file.artist}</div>
                    <div className="music-album">{file.album}</div>
                </div>
                <img src={file.albumArt} alt="bine" className="album-image" />
                {state.isUserAddingSongToPlaylist.isit ? (
                    <button className="play-button" onClick={async () => {
                        let sumDumbshi = false
                        let selectedPlaylist: any = {}
                        state.playlists?.find(playlist => {
                            if (playlist === state.isUserAddingSongToPlaylist.playlist) {
                                if (file.id !== undefined) {
                                    playlist.songs.push(file)
                                    sumDumbshi = true
                                    selectedPlaylist = playlist;
                                }
                            }
                        })
                        if (sumDumbshi) {
                            let token = Cookies.get('token')
                            await axios.post(`${hostname}/user/playlist/addsong`, `jwt=${token}&playlist=${selectedPlaylist.title}&song=${file.id}`)
                        }
                    }}>add song</button>
                ) : (
                    <>
                        <button className="play-button" onClick={() => player.bang(file)}>play</button>
                        <button className="queue-button" onClick={() => player.addToQueue(file)}>add to queue</button>
                    </>
                )}
            </div>
        </div>
    )

    let showQueue = !player.shuffle ? (
        player.queue.length > 0 ? (
            player.queue.map((song) =>
                <div style={{ display: "flex", flexDirection: "column" }} className="queue-inner-wrapper" ref={queueInnerRef}>
                    <span className="queue-song-name">
                        {song.file.split(`${state.userData?.username}/`)[1].replace(".mp3", "")}
                        bosh
                    </span>
                    <span style={{ fontSize: "12px" }} className="queue-remove-song" onClick={() => player.removeFromQueue(song.id)}>remove?</span>
                </div>
            )
        ) : (
            <div className="queue-inner-wrapper" style={{ textAlign: "center" }}>
                <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
            </div>
        )
    ) : (
        player.shuffledting.length > 0 ? (
            player.shuffledting.map((song) =>
                <div style={{ display: "flex", flexDirection: "column" }} className="queue-inner-wrapper" ref={queueInnerRef}>
                    <span className="queue-song-name">
                        {song.file.split(`${state.userData?.username}/`)[1].replace(".mp3", "")}
                    </span>
                    <span style={{ fontSize: "12px" }} className="queue-remove-song" onClick={() => player.removeFromQueue(song.id)}>remove?</span>
                </div>
            )
        ) : (
            <div className="queue-inner-wrapper" style={{ textAlign: "center" }}>
                <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
            </div>
        ) 
    )

    let showPlaylists = state.playlists?.map((playlist) =>
        <div className="playlist-wrapper" onClick={() => {updateState("sumPlaylist", {visible: true, selectedPlaylist: playlist})}}>
            <div className="playlist-title-wrapper">
                <span className="playlist-title">{playlist.title}</span>
            </div>
            <img src={playlist.picture} className="playlist-image" />
        </div>
    )

    let showSongsInPlaylist = state.sumPlaylist.selectedPlaylist ? (
        state.sumPlaylist.selectedPlaylist?.songs.length > 0 ? (
            state.sumPlaylist.selectedPlaylist?.songs.map((song, index) =>
                <>
                    <div className="song-data-inner-wrapper" onClick={async () => {
                        if (state.isUserRemovingSongFromPlaylist.isit) {
                            let sumDumbshi = false
                            let selectedPlaylist: any = {}
                            let allPlaylists: any[] = []
                            state.playlists?.find(playlist => {
                                if (playlist === state.isUserRemovingSongFromPlaylist.playlist) {
                                    if (song.id !== undefined) {
                                        const songIndex = playlist.songs.findIndex((s: any) => s.id === song.id);
                                        if (songIndex !== -1) {
                                            playlist.songs.splice(songIndex, 1)
                                            sumDumbshi = true;
                                            selectedPlaylist = playlist;
                                        }
                                    }
                                }
                                allPlaylists.push(playlist)
                            })
                            if (sumDumbshi) {
                                updateState("playlists", allPlaylists)
                                console.log('nig')
                                let token = Cookies.get('token')
                                let x = await axios.post(`${hostname}/user/playlist/removesong`, `jwt=${token}&playlist=${selectedPlaylist.title}&song=${song.id}`)
                                console.log(x.data)
                            }
                        } else {
                            if (player.queue.length > 0) {
                                player.queue = []
                            }
                            player.bang(song)
                            let after = state.sumPlaylist.selectedPlaylist?.songs.slice(index + 1)
                            if (after) {
                                after.map(buddabang => {
                                    player.addToQueue(buddabang)
                                })
                            }
                            updateState("updatetofixsumbrokenshi", !state.updatetofixsumbrokenshi)
                        }
                    }}>
                        <span className="song-data-title">{song.title}</span>
                        <span className="song-data-artist">{song.artist}</span>
                    </div>
                </>
            )
        ) : (
            <div className="no-song-data-found">
                <span className="no-song-data-found-text">nun to see here</span>
            </div>
        )
    ) : (
        <span>mad error g</span>
    )

    const handleSongsSortChange = (e: Event) => {
        const val = (e.target as HTMLSelectElement).value
        updateState("songsSortOption", val)

        switch (val) {
            case "alphabetical":
                sortSongsAlphabetically()
                break;
            case "reverse alphabetical":
                sortSongsReverseAlphabetically()
                break;
            case "date first":
                sortSongsAddedFirst()
                break;
            case "date last":
                sortSongsAddedLast()
                break;
        }
    }

    const sortSongsAddedLast = () => {
        if (state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            updateState("sumPlaylist", {
                ...state.sumPlaylist,
                selectedPlaylist: {
                    ...state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsAddedFirst = () => {
        if (state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            updateState("sumPlaylist", {
                ...state.sumPlaylist,
                selectedPlaylist: {
                    ...state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsAlphabetically = () => {
        if (state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => a.title.localeCompare(b.createdAt));
            updateState("sumPlaylist", {
                ...state.sumPlaylist,
                selectedPlaylist: {
                    ...state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsReverseAlphabetically = () => {
        if (state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => b.title.localeCompare(a.title));
            updateState("sumPlaylist", {
                ...state.sumPlaylist,
                selectedPlaylist: {
                    ...state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    return (
        <>
            {state.data && state.userData ? (
                <div className="shotgunshells">
                    {state.isUserRemovingSongFromPlaylist.isit ? (
                        <div className="removing-songs-notice">
                            <span>removing songs!!!</span>
                            <span className="removing-songs-stop-button" onClick={() => updateState("isUserRemovingSongFromPlaylist", {isit: false})}>stop?</span>
                        </div>
                    ) : null}
                    {state.graphicalMode ? (
                        <div>
                            {state.isUserAddingSongToPlaylist.isit ? (
                                <div className="user-adding-song-go-back-wrapper">
                                    <span className="user-adding-song-go-back" onClick={() => {
                                        updateState("isUserAddingSongToPlaylist", {isit: false, playlist: undefined})
                                        updateState("graphicalMode", false)
                                    }}>go back to playlist?</span>
                                </div>
                            ) : null}
                            {state.isSearchBarVisible ? (
                                <div className="search-bar">
                                    <input
                                        type="text"
                                        className="search-bar-input"
                                        placeholder="search..."
                                        value={state.searchQuery}
                                        onInput={(e) => updateState("searchQuery", (e.target as HTMLInputElement).value)}
                                    />
                                </div>
                            ) : null}
                            {state.isQueueVisible ? (
                                <div className="queue-wrapper">
                                    {/* cuz thats neccersarry im so tired */}
                                    <div className="queue-inner-wrapper">
                                        {showQueue}
                                    </div>
                                </div>
                            ) : null}
                            <Profile profilePicture={state.userData.profilePicture}
                                isProfileVisible={state.isProfileMenuVisible}
                                onToggleProfileMenu={() => updateState("isProfileMenuVisible", !state.isProfileMenuVisible)}>
                                <div style={profileMenuButtonStyle} onClick={() => window.location.href = '/oblock'}>
                                    <SettingsIcon style={profileMenuButtonStyle} className="profile-menu-settings" />
                                </div>
                                <div style={profileMenuButtonStyle} onClick={() => updateState("isSearchBarVisible", !state.isSearchBarVisible)}>
                                    <SearchIcon style={profileMenuButtonStyle} className="profile-menu-search" />
                                </div>
                                <div style={profileMenuButtonStyle} onClick={() => updateState("isUploadOverlayVisible", !state.isUploadOverlayVisible)}>
                                    <FileUploadIcon style={profileMenuButtonStyle} />
                                </div>
                                <div style={profileMenuButtonStyle} onClick={(() => updateState("isDownloadOverlayVisible", !state.isDownloadOverlayVisible))}>
                                    <DownloadIcon style={profileMenuButtonStyle} />
                                </div>
                                <div className="letdemshotsfly" style={profileMenuButtonStyle} onClick={() => queueBangFraud()}>
                                    <QueueIcon style={profileMenuButtonStyle} className="letdemshotsfly-button" />
                                </div>
                                <div className="skizzy" style={profileMenuButtonStyle} onClick={() => updateState("graphicalMode", false)}>
                                    <FlipIcon style={profileMenuButtonStyle} className="skizzy-button" />
                                </div>
                            </Profile>
                            <div className="music-wrapper">
                                {showGraphicalData}
                            </div>
                        </div>
                    ) : /*other ui*/ (
                        <div>
                            {state.isQueueVisible ? (
                                <div className="queue-wrapper">
                                    {/* cuz thats neccersarry im so tired */}
                                    <div className="queue-inner-wrapper margin-fix-other-ui">
                                        {showQueue}
                                    </div>
                                </div>
                            ) : null}
                            <Profile profilePicture={state.userData.profilePicture}
                                isProfileVisible={state.isProfileMenuVisible}
                                onToggleProfileMenu={() => updateState("isProfileMenuVisible", !state.isProfileMenuVisible)}>
                                <div style={profileMenuButtonStyle} onClick={() => window.location.href = '/oblock'}>
                                    <SettingsIcon style={profileMenuButtonStyle} className="profile-menu-settings" />
                                </div>
                                <div style={profileMenuButtonStyle} onClick={() => updateState("isUploadOverlayVisible", !state.isUploadOverlayVisible)}>
                                    <FileUploadIcon style={profileMenuButtonStyle} />
                                </div>
                                <div style={profileMenuButtonStyle} onClick={(() => updateState("isDownloadOverlayVisible", !state.isDownloadOverlayVisible))}>
                                    <DownloadIcon style={profileMenuButtonStyle} />
                                </div>
                                <div className="letdemshotsfly" style={profileMenuButtonStyle} onClick={() => updateState("isQueueVisible", !state.isQueueVisible)}>
                                    <QueueIcon style={profileMenuButtonStyle} className="letdemshotsfly-button" />
                                </div>
                                <div className="skizzy" style={profileMenuButtonStyle} onClick={() => updateState("graphicalMode", true)}>
                                    <FlipIcon style={profileMenuButtonStyle} className="skizzy-button" />
                                </div>
                            </Profile>
                            <div className="playlist-mode-wrapper">
                                <div className={`playlist-mode-content ${state.isUserAddingPlaylist ? 'grayed-out' : ''}`}>
                                    {state.sumPlaylist.visible ? (
                                        <div className="selected-playlist-go-back-wrapper">
                                            <span className="selected-playlist-go-back" onClick={() => updateState("sumPlaylist", {visible: false})}>go back?</span>
                                        </div>
                                    ) : (<></>)}
                                    <div className="playlist-top-bar">
                                        {player.currentSong.object ? (
                                            <>
                                                <div className="playlist-current-song">
                                                    <span className="playlist-current-song-label">{state.data.find(musicfile => musicfile.url === player.currentSong.url)?.title}</span>
                                                    <span className="playlist-current-song-artist">{state.data.find(musicfile => musicfile.url === player.currentSong.url)?.artist}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="playlist-current-song">
                                                <span className="playlist-no-song-label">select sum</span>
                                            </div>
                                        )}
                                        {/* {state.sumPlaylist.visible ? (
                                            <div className="selected-playlist-go-back-wrapper">
                                                <span className="selected-playlist-go-back" onClick={() => updateState("sumPlaylist", {visible: false})}>go back?</span>
                                            </div>
                                        ) : (<></>)} */}
                                        {!state.sumPlaylist.visible ? (
                                            <div className="playlist-add-icon-wrapper" onClick={() => updateState("isUserAddingPlaylist", !state.isUserAddingPlaylist)}>
                                                <AddIcon className="playlist-add-icon" />
                                            </div>
                                            ) : (
                                            <div className="playlist-add-icon-wrapper">
                                                <RemoveIcon className="song-data-remove-song" onClick={() => {
                                                    console.log('pressed')
                                                    updateState("isUserRemovingSongFromPlaylist", {isit: true, playlist: state.sumPlaylist.selectedPlaylist})
                                                }}/>
                                                <AddIcon className="playlist-add-icon" onClick={() => {
                                                    updateState("isUserAddingSongToPlaylist", {isit: true, playlist: state.sumPlaylist.selectedPlaylist})
                                                    updateState("graphicalMode", true)
                                                }}/>
                                            </div>
                                            )
                                        }
                                        </div>
                                    {state.sumPlaylist.visible && state.sumPlaylist.selectedPlaylist ? (
                                        <div className="playlist-display-wrapper">
                                            {/* <div className="selected-playlist-go-back-wrapper">
                                                <span className="selected-playlist-go-back" onClick={() => updateState("sumPlaylist", {visible: false})}>go back?</span>
                                            </div> */}
                                            <div className="playlist-meta-grid">
                                                <img src={state.sumPlaylist.selectedPlaylist.picture} className="selected-album-picture"/>
                                                <div className="selected-playlist-name-wrapper">
                                                    <span className="selected-playlist-name">{state.sumPlaylist.selectedPlaylist.title}</span>
                                                    <div className="selected-playlist-play-icon-wrapper" onClick={() => {
                                                        if (state.sumPlaylist.selectedPlaylist && state.sumPlaylist.selectedPlaylist.songs.length > 0) {
                                                            state.sumPlaylist.selectedPlaylist?.songs.map(file => player.addToQueue(file))
                                                            player.bang(state.sumPlaylist.selectedPlaylist.songs[0])
                                                            player.queue.splice(0, 1)
                                                        }
                                                        state.sumPlaylist.selectedPlaylist?.songs.map(file => player.addToQueue(file))
                                                    }}>
                                                        <PlayArrow style={{backgroundColor: "transparent", left: 0, marginLeft: 0}} fontSize="large" className="selected-playlist-play-icon"/>
                                                    </div>
                                                    <div className="selected-playlist-change-picture">
                                                        <button className="selected-playlist-change-picture-button">change picture?</button> 
                                                    </div>
                                                    <div className="selected-playlist-sort-songs">
                                                        <select value={state.songsSortOption} onChange={handleSongsSortChange}>
                                                            <option value="alphabetical">alphabetical</option>
                                                            <option value="reverse alphabetical">reverse alphabetical</option>
                                                            <option value="date first">added first</option>
                                                            <option value="date last">added last</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="playlist-display-content">
                                                {showSongsInPlaylist}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="playlists-wrapper">
                                            {showPlaylists}
                                        </div>
                                    )}
                                    {state.isUserAddingPlaylist ? (
                                        <div className="playlist-create-new">
                                            <span className="playlist-create-new-label">create a new playlist</span>
                                            <input placeholder="enter a playlist name" className="playlist-create-new-input" onInput={
                                                e => updateState("newPlayListValue", e.currentTarget.value)
                                            } />
                                            <button className="playlist-create-new-submit" onClick={async () => {
                                                if (state.newPlayListValue) {
                                                    let token = Cookies.get('token')
                                                    let req = await axios.post(`${hostname}/user/playlist/create`, `jwt=${token}&title=${state.newPlayListValue}`)
                                                    console.log(req.data.success)
                                                    if (state.playlists) {
                                                        state.playlists.push(req.data.success)
                                                        updateState("isUserAddingPlaylist", false)
                                                    }
                                                } else {
                                                    alert('enter a playlist name dummy')
                                                }
                                            }}>submit</button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                    <MusicPlayer musicPlayer={player} isDownloadOverlayVisible={state.isDownloadOverlayVisible} isUploadOverlayVisible={state.isUploadOverlayVisible} updateGlobalState={updateState} updatetofixsumbrokenshi={state.updatetofixsumbrokenshi}/>
                </div>
            ) : (
                <span style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100vw",
                    height: "100vh"
                }}>🙈Loading🙉</span>
            )}
        </>
    )
}

export const bludclart = withAuth(bludclartPage)