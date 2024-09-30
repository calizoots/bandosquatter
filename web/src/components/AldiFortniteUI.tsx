import axios from "axios"
import Player from "./MusicPlayerThatPlaysMusic"
import SettingsIcon from '@mui/icons-material/Settings';
import FlipIcon from '@mui/icons-material/Flip';
import AddIcon from '@mui/icons-material/Add';
import QueueIcon from '@mui/icons-material/Queue';
import PlayArrow from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import RemoveIcon from '@mui/icons-material/Remove';
import Cookies from 'js-cookie';
import Queue from "./smallbits/Queue";
import { hostname } from "../global/global";
import { Profile } from "./Profile"
import { State } from "../pages/bludclart"
import "./styles/profile.scss"
import "../pages/styles/bludclart.scss"
import "./styles/AldiFortniteUI.scss"

//asdfasdfassdjk

export let profileMenuButtonStyle: React.JSX.CSSProperties = { backgroundColor: "transparent", cursor: "pointer" }

interface AldiForniteProps {
    player: Player
    state: State
    updateState: <K extends keyof State>(key: K, value: State[K]) => void
}

let AldiFornite: React.FC<AldiForniteProps> = (props) => {
    let player = props.player
    let updateState = props.updateState

    let showPlaylists = props.state.playlists?.map((playlist) =>
        <div className="playlist-wrapper" onClick={() => { updateState("sumPlaylist", { visible: true, selectedPlaylist: playlist }) }}>
            <div className="playlist-title-wrapper">
                <span className="playlist-title">{playlist.title}</span>
            </div>
            <img src={playlist.picture} className="playlist-image" />
        </div>
    )

    let showSongsInPlaylist = props.state.sumPlaylist.selectedPlaylist ? (
        props.state.sumPlaylist.selectedPlaylist?.songs.length > 0 ? (
            props.state.sumPlaylist.selectedPlaylist?.songs.map((song, index) =>
                <>
                    <div className="song-data-inner-wrapper" onClick={async () => {
                        if (props.state.isUserRemovingSongFromPlaylist.isit) {
                            let sumDumbshi = false
                            let selectedPlaylist: any = {}
                            let allPlaylists: any[] = []
                            props.state.playlists?.find(playlist => {
                                if (playlist === props.state.isUserRemovingSongFromPlaylist.playlist) {
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
                            let after = props.state.sumPlaylist.selectedPlaylist?.songs.slice(index + 1)
                            if (after) {
                                after.map(buddabang => {
                                    player.addToQueue(buddabang)
                                })
                            }
                            updateState("updatetofixsumbrokenshi", !props.state.updatetofixsumbrokenshi)
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
        if (props.state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...props.state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            updateState("sumPlaylist", {
                ...props.state.sumPlaylist,
                selectedPlaylist: {
                    ...props.state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsAddedFirst = () => {
        if (props.state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...props.state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            updateState("sumPlaylist", {
                ...props.state.sumPlaylist,
                selectedPlaylist: {
                    ...props.state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsAlphabetically = () => {
        if (props.state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...props.state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => a.title.localeCompare(b.createdAt));
            updateState("sumPlaylist", {
                ...props.state.sumPlaylist,
                selectedPlaylist: {
                    ...props.state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    const sortSongsReverseAlphabetically = () => {
        if (props.state.sumPlaylist.selectedPlaylist) {
            let sortedSongs = [...props.state.sumPlaylist.selectedPlaylist.songs];
            sortedSongs.sort((a, b) => b.title.localeCompare(a.title));
            updateState("sumPlaylist", {
                ...props.state.sumPlaylist,
                selectedPlaylist: {
                    ...props.state.sumPlaylist.selectedPlaylist,
                    songs: sortedSongs,
                },
            });
        }
    }

    return (
        <>
            {props.state.userData && props.state.data ? (
                <div>
                    <Queue player={props.player} state={props.state} />
                    <Profile profilePicture={props.state.userData.profilePicture}
                        isProfileVisible={props.state.isProfileMenuVisible}
                        onToggleProfileMenu={() => updateState("isProfileMenuVisible", !props.state.isProfileMenuVisible)}>
                        <div style={profileMenuButtonStyle} onClick={() => window.location.href = '/oblock'}>
                            <SettingsIcon style={profileMenuButtonStyle} className="profile-menu-settings" />
                        </div>
                        <div style={profileMenuButtonStyle} onClick={() => updateState("isUploadOverlayVisible", !props.state.isUploadOverlayVisible)}>
                            <FileUploadIcon style={profileMenuButtonStyle} />
                        </div>
                        <div style={profileMenuButtonStyle} onClick={(() => updateState("isDownloadOverlayVisible", !props.state.isDownloadOverlayVisible))}>
                            <DownloadIcon style={profileMenuButtonStyle} />
                        </div>
                        <div className="letdemshotsfly" style={profileMenuButtonStyle} onClick={() => updateState("isQueueVisible", !props.state.isQueueVisible)}>
                            <QueueIcon style={profileMenuButtonStyle} className="letdemshotsfly-button" />
                        </div>
                        <div className="skizzy" style={profileMenuButtonStyle} onClick={() => updateState("graphicalMode", true)}>
                            <FlipIcon style={profileMenuButtonStyle} className="skizzy-button" />
                        </div>
                    </Profile>
                    <div className="playlist-mode-wrapper">
                        <div className={`playlist-mode-content ${props.state.isUserAddingPlaylist ? 'grayed-out' : ''}`}>
                            {props.state.sumPlaylist.visible ? (
                                <div className="selected-playlist-go-back-wrapper">
                                    <span className="selected-playlist-go-back" onClick={() => updateState("sumPlaylist", { visible: false })}>go back?</span>
                                </div>
                            ) : (<></>)}
                            <div className="playlist-top-bar">
                                {player.currentSong.object ? (
                                    <>
                                        <div className="playlist-current-song">
                                            <span className="playlist-current-song-label">{props.state.data.find(musicfile => musicfile.url === player.currentSong.url)?.title}</span>
                                            <span className="playlist-current-song-artist">{props.state.data.find(musicfile => musicfile.url === player.currentSong.url)?.artist}</span>
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
                                {!props.state.sumPlaylist.visible ? (
                                    <div className="playlist-add-icon-wrapper" onClick={() => updateState("isUserAddingPlaylist", !props.state.isUserAddingPlaylist)}>
                                        <AddIcon className="playlist-add-icon" />
                                    </div>
                                ) : (
                                    <div className="playlist-add-icon-wrapper">
                                        <RemoveIcon className="song-data-remove-song" onClick={() => {
                                            console.log('pressed')
                                            updateState("isUserRemovingSongFromPlaylist", { isit: true, playlist: props.state.sumPlaylist.selectedPlaylist })
                                        }} />
                                        <AddIcon className="playlist-add-icon" onClick={() => {
                                            updateState("isUserAddingSongToPlaylist", { isit: true, playlist: props.state.sumPlaylist.selectedPlaylist })
                                            updateState("graphicalMode", true)
                                        }} />
                                    </div>
                                )
                                }
                            </div>
                            {props.state.sumPlaylist.visible && props.state.sumPlaylist.selectedPlaylist ? (
                                <div className="playlist-display-wrapper">
                                    {/* <div className="selected-playlist-go-back-wrapper">
                                           <span className="selected-playlist-go-back" onClick={() => updateState("sumPlaylist", {visible: false})}>go back?</span>
                                       </div> */}
                                    <div className="playlist-meta-grid">
                                        <img src={props.state.sumPlaylist.selectedPlaylist.picture} className="selected-album-picture" />
                                        <div className="selected-playlist-name-wrapper">
                                            <span className="selected-playlist-name">{props.state.sumPlaylist.selectedPlaylist.title}</span>
                                            <div className="selected-playlist-play-icon-wrapper" onClick={() => {
                                                if (props.state.sumPlaylist.selectedPlaylist && props.state.sumPlaylist.selectedPlaylist.songs.length > 0) {
                                                    props.state.sumPlaylist.selectedPlaylist?.songs.map(file => player.addToQueue(file))
                                                    player.bang(props.state.sumPlaylist.selectedPlaylist.songs[0])
                                                    player.queue.splice(0, 1)
                                                }
                                                props.state.sumPlaylist.selectedPlaylist?.songs.map(file => player.addToQueue(file))
                                            }}>
                                                <PlayArrow style={{ backgroundColor: "transparent", left: 0, marginLeft: 0 }} fontSize="large" className="selected-playlist-play-icon" />
                                            </div>
                                            <div className="selected-playlist-change-picture">
                                                <button className="selected-playlist-change-picture-button">change picture?</button>
                                            </div>
                                            <div className="selected-playlist-sort-songs">
                                                <select value={props.state.songsSortOption} onChange={handleSongsSortChange}>
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
                            {props.state.isUserAddingPlaylist ? (
                                <div className="playlist-create-new">
                                    <span className="playlist-create-new-label">create a new playlist</span>
                                    <input placeholder="enter a playlist name" className="playlist-create-new-input" onInput={
                                        e => updateState("newPlayListValue", e.currentTarget.value)
                                    } />
                                    <button className="playlist-create-new-submit" onClick={async () => {
                                        if (props.state.newPlayListValue) {
                                            let token = Cookies.get('token')
                                            let req = await axios.post(`${hostname}/user/playlist/create`, `jwt=${token}&title=${props.state.newPlayListValue}`)
                                            console.log(req.data.success)
                                            if (props.state.playlists) {
                                                props.state.playlists.push(req.data.success)
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
            ) : null}
        </>
    )
}

export default AldiFornite;