import axios from "axios"
import { useEffect } from "preact/hooks"
import Cookies from "js-cookie"
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import FlipIcon from '@mui/icons-material/Flip';
import QueueIcon from '@mui/icons-material/Queue';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { hostname } from "../global/global"
import { Profile } from "./Profile"
import Player from "./MusicPlayerThatPlaysMusic"
import { State } from "../pages/bludclart"
import Loading from "./smallbits/Loading"
import Queue from "./smallbits/Queue"
import "./styles/profile.scss"
import "./styles/AldiFortniteUI.scss"
import "../pages/styles/bludclart.scss"

export let profileMenuButtonStyle: React.JSX.CSSProperties = { backgroundColor: "transparent", cursor: "pointer" }


interface GraphicalUIProps {
    player: Player
    state: State
    updateState: <K extends keyof State>(key: K, value: State[K]) => void
}

export let GraphicalUI: React.FC<GraphicalUIProps> = (props) => {

    let state = props.state;
    let updateState = props.updateState

    useEffect(() => {
        props.player.onQueueUpdate = () => {
            updateState("queue", [...props.player.queue]);
        };

        return () => {
            props.player.onQueueUpdate = null;
        };
    }, []);

    let queueBangFraud = () => {
        props.updateState("searchQuery", "")
        updateState("isQueueVisible", !props.state.isQueueVisible)
    }

    let filteredGraphicalData = props.state.data?.filter(file =>
        file.title.toLowerCase().includes(props.state.searchQuery.toLowerCase()) ||
        file.artist.toLowerCase().includes(props.state.searchQuery.toLowerCase())
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
                {props.state.isUserAddingSongToPlaylist.isit ? (
                    <button className="play-button" onClick={async () => {
                        let sumDumbshi = false
                        let selectedPlaylist: any = {}
                        props.state.playlists?.find(playlist => {
                            if (playlist === props.state.isUserAddingSongToPlaylist.playlist) {
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
                        <button className="play-button" onClick={() => props.player.bang(file)}>play</button>
                        <button className="queue-button" onClick={() => props.player.addToQueue(file)}>add to queue</button>
                    </>
                )}
            </div>
        </div>
    )


    return (
        <>
            {props.state.userData ? (
                <div>
                    {state.isUserAddingSongToPlaylist.isit ? (
                        <div className="user-adding-song-go-back-wrapper">
                            <span className="user-adding-song-go-back" onClick={() => {
                                updateState("isUserAddingSongToPlaylist", { isit: false, playlist: undefined })
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
                    <Queue player={props.player} state={state}/> 
                    <Profile profilePicture={props.state.userData.profilePicture}
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
            ) : <Loading />}
        </>
    )
}

