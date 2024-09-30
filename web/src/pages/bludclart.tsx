import axios from "axios"
import { useState, useEffect } from "preact/hooks"
import { withAuth } from "../methods/withAuth"
import { musicFile, MusicPlayer, QueueType } from "../components/MusicPlayer.tsx"
import Cookies from "js-cookie"
import { hostname } from "../global/global"
import Player from "../components/MusicPlayerThatPlaysMusic"
import Loading from "../components/smallbits/Loading"
import { GraphicalUI } from "../components/GraphicalUI"
import AldiFornite from "../components/AldiFortniteUI"
import "../components/styles/profile.scss"
import "./styles/bludclart.scss"

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
        player.onQueueUpdate = () => {
            updateState("queue", [...player.queue]);
        };

        return () => {
            player.onQueueUpdate = null;
        };
    }, []);

    return (
        <>
            {state.data && state.userData && state.playlists ? (
                <div className="shotgunshells">
                    {state.isUserRemovingSongFromPlaylist.isit ? (
                        <div className="removing-songs-notice">
                            <span>removing songs!!!</span>
                            <span className="removing-songs-stop-button" onClick={() => updateState("isUserRemovingSongFromPlaylist", {isit: false})}>stop?</span>
                        </div>
                    ) : null}
                    {state.graphicalMode ? (
                        <GraphicalUI player={player} state={state} updateState={updateState}/>
                    ) : /*other ui*/ (
                        <AldiFornite player={player} state={state} updateState={updateState} />
                    )}
                    <MusicPlayer musicPlayer={player} isDownloadOverlayVisible={state.isDownloadOverlayVisible} isUploadOverlayVisible={state.isUploadOverlayVisible} updateGlobalState={updateState} updatetofixsumbrokenshi={state.updatetofixsumbrokenshi}/>
                </div>
            ) : (
                <Loading /> 
            )}
        </>
    )
}

export const bludclart = withAuth(bludclartPage)