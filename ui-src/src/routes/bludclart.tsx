import { useEffect, useState } from "preact/hooks";
import { withAuth } from "../components/withAuth";
import { HOSTNAME } from '../global.ts';
import '../css/bludclart.scss';
import Player, { type QueueType } from "../components/Player.ts";
import { MusicPlayer } from "../components/PlayerUI.tsx";
import { useError } from "../components/error.tsx";
import FileUpload from "../components/FileUpload.tsx";

export type MusicRow = {
    id: number,
    userid: number,
    backend: string,
    location: string,
    cover_blob?: number[],
    cover_location: string,
    title: string,
    artist: string,
    album?: string,
    year?: string,
    date_added: number,
    size: number,
};

export type PlaylistRow = {
    id: number,
    userid: number,
    picture: number[],
    title: string,
    date_added: number,
};

type SumPlaylist = {
    visible: boolean,
    value?: PlaylistRow,
}

type PlaylistState = {
    playlists: PlaylistRow[],
    isPlaylistUI: boolean,
    isSelectingPlaylist: boolean,
    selectedPlaylist: PlaylistRow | null,
    isMusicPlayerVisible: boolean,
    playlistName: string,
    sumPlaylist: SumPlaylist,
    isUploadingPlaylist: boolean,
};

type AppState = {
    allMusic: MusicRow[],
    music: MusicRow[],
    queue: QueueType[],
};

function CoverImage({ coverLocation }: { coverLocation: String; }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        const fetchImage = async () => {
            const res = await fetch(`${HOSTNAME}${coverLocation}`, {
                credentials: "include",
            });

            if (!res.ok) return;

            const blob = await res.blob();
            setSrc(URL.createObjectURL(blob));
        };

        fetchImage();
    }, [coverLocation]);

    if (!src) return <div style={{ width: "100%", height: "200px", background: "#333" }} />;

    return <img src={src} alt={`missing cover`} style={{ width: "100%", height: "auto" }} className="music-image" />;
}

function MusicCard({ file, player }: { file: MusicRow, player: Player }) {
    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
        if (showOverlay) {
            const timer = setTimeout(() => setShowOverlay(false), 10_000);
            return () => clearTimeout(timer);
        }
    }, [showOverlay]);

    return (
        <div
            className={`music-card ${showOverlay ? 'show' : ''}`}
            onClick={() => setShowOverlay(prev => !prev)}
        >
            <CoverImage coverLocation={file.cover_location} />

            <div className="music-info">
                <div className="music-info-element">{file.title}</div>
                <div className="music-info-element">{file.artist}</div>
                <div className="music-info-element">{file.album}</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <button
                        className="music-play"
                        onClick={(e) => {
                            e.stopPropagation(); // don’t toggle overlay
                            player.bang(file);
                        }}
                    >
                        play
                    </button>
                </div>
            </div>

            <div
                className="add-to-queue"
                onClick={(_) => {
                    player.addToQueue(file);
                }}
                style={{}}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="add-queue-icon" viewBox="0 -960 960 960" width="24px">
                    <path d="M440-360h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM320-120v-80H160q-33 0-56.5-23.5T80-280v-480q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v480q0 33-23.5 56.5T800-200H640v80H320ZM160-280h640v-480H160v480Zm0 0v-480 480Z" />
                </svg>
            </div>
        </div>
    );
}

function OtherUI({ playlistState, updatePlaylistState }: { playlistState: PlaylistState, updatePlaylistState: <K extends keyof PlaylistState> (key: K, value: PlaylistState[K]) => void }) {
    let content;

    if (playlistState.sumPlaylist.visible) {
        let playlist = playlistState.sumPlaylist.value!;

        const url = URL.createObjectURL(
            new Blob([new Uint8Array(playlist.picture)], { type: "image/jpeg" })
        );

        content = (
            <div>
                <img
                    src={url}
                    alt={playlist.title}
                    className="playlist-selected-image"
                />
            </div>
        );
    } else {
        content = (
            <div className="show-playlists">
                {playlistState.playlists.map((playlist) => {
                    const bytes = new Uint8Array(playlist.picture);
                    const blob = new Blob([bytes], { type: "image/jpeg" });
                    const url = URL.createObjectURL(blob);

                    return (
                        <div
                            key={playlist.id}
                            className="playlist-inner-wrapper"
                            onClick={() => {
                                let newobj: SumPlaylist = {
                                    visible: true,
                                    value: playlist,
                                };
                                updatePlaylistState("sumPlaylist", newobj);
                            }}
                        >
                            <img
                                src={url}
                                alt={playlist.title}
                                className="playlist-image"
                            />
                            <div className="playlist-info">
                                <div className="playlist-info-element">{playlist.title}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return <>{content}</>;
}

let player = new Player();

const oblockpage = () => {
    let { pushError } = useError();

    let [state, setState] = useState<AppState>({
        allMusic: [],
        music: [],
        queue: player.queue,

    })

    const updateState = <K extends keyof AppState>(key: K, value: AppState[K]) => {
        setState(prevState => ({
            ...prevState,
            [key]: value,
        }));
    };

    let [playlistState, setPlaylistState] = useState<PlaylistState>({
        playlists: [],

        playlistName: "",

        sumPlaylist: { visible: false },
        isMusicPlayerVisible: true,
        isPlaylistUI: true,
        isSelectingPlaylist: true,
        isUploadingPlaylist: false,
        selectedPlaylist: null,
    })

    const updatePlaylistState = <K extends keyof PlaylistState>(key: K, value: PlaylistState[K]) => {
        setPlaylistState(prevState => ({
            ...prevState,
            [key]: value,
        }));
    };

    let fetchFromApi = async (endpoint: string, callback: (data: any) => void) => {
        let response = await fetch(`${HOSTNAME}${endpoint}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: "include",
        });

        let data = await response.json();

        callback(data)
    }

    useEffect(() => {
        let goGet = async () => {
            try {
                await fetchFromApi("/music/get", (data) => {
                    if (data.music) {
                        updateState('allMusic', data.music);
                        updateState('music', data.music);
                    } else {
                        pushError(data.reason);
                    }
                })

                await fetchFromApi("/playlist/get", (data) => {
                    if (data.playlists) {
                        updatePlaylistState('playlists', data.playlists);
                    } else {
                        pushError(data.reason)
                    }
                })
            } catch (err) {
                pushError(`${err}`);
            }
        }

        goGet();
    }, []);

    useEffect(() => {
        player.onQueueUpdate = () => {
            updateState('queue', [...player.queue]);
        };

        return () => {
            player.onQueueUpdate = null;
        };
    }, []);

    let showGraphicalData = state.music.map(file => (
        <MusicCard file={file} player={player} />
    ))

    return (
        <>
            {playlistState.isPlaylistUI ? (
                <div className={`playlist-wrapper ${playlistState.isMusicPlayerVisible ? 'short' : ''}`}>

                    <div className="playlist-top-bar">
                        {playlistState.isSelectingPlaylist ? (
                            <div className="playlist-icon-wrapper" style={{ cursor: "pointer" }} onClick={() => updatePlaylistState("isUploadingPlaylist", !playlistState.isUploadingPlaylist)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="playlist-icon" viewBox="0 -960 960 960">
                                    <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                                </svg>
                            </div>
                        ) : <div style={{ width: "24px" }} />}
                        {/* dummy spacer keeps text centered if icon is hidden */}
                        {player.currentSong.object ? (
                            <div className="current-song">
                                <span style={{ fontSize: "clamp(14px, 2vw, 18px)" }}>{state.allMusic.find(musicfile => musicfile.location === player.currentSong.url)?.title}</span>
                                <span style={{ fontSize: "clamp(12px, 1vw, 16px)" }}>{state.allMusic.find(musicfile => musicfile.location === player.currentSong.url)?.artist}</span>
                            </div>
                        ) : <span>nothing is playing!</span>}
                    </div>

                    {playlistState.isSelectingPlaylist ? (
                        <div>
                            {playlistState.playlists.length ? (
                                <OtherUI playlistState={playlistState} updatePlaylistState={updatePlaylistState} />
                            ) : (
                                <div style={{ marginTop: 5, textAlign: 'center', width: "calc(100vw - 40px)" }}>its empty around here</div>
                            )}
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="music-wrapper">
                    {showGraphicalData}
                </div>
            )}

            {playlistState.isUploadingPlaylist ? (
                <div
                    style={{
                        height: "100vh",
                        width: "100vw",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "fixed",
                        backgroundColor: "transparent",
                        top: 0,
                        left: 0,
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            height: "clamp(250px, 35vh, 550px)",
                            width: "clamp(250px, 20vw, 550px)",
                            backgroundColor: "transparent",
                            background: "rgba(0,0,0,0.4)",
                            backdropFilter: "blur(5px)",
                            border: "1px solid black",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "10px",
                            flexDirection: "column",
                            borderRadius: "6px",
                            zIndex: 20000,
                            pointerEvents: "auto",
                        }}
                    >
                        <input style={{
                            height: "1.5rem",
                            textAlign: "center",
                            width: "10vw",
                            minWidth: "100px"
                        }}
                            placeholder="playlist name..."
                            type="text" value={playlistState.playlistName}
                            onChange={(e) => updatePlaylistState("playlistName", e.currentTarget.value)}
                        />

                        <FileUpload endpoint="/playlist/new" accept="image/png, image/jpeg" onComplete={(resp) => {
                            updatePlaylistState("playlistName", "");
                            pushError(resp.status, true);
                        }} onError={(err) => {
                            updatePlaylistState("playlistName", "");
                            pushError(err.message)
                        }} buildFormData={(file: File) => {
                            const form = new FormData();
                            form.append("picture", file, file.name);
                            form.append("title", playlistState.playlistName)
                            return form
                        }} />
                    </div>
                </div >
            ) : null}

            <MusicPlayer musicPlayer={player} onSearchUpdate={(search: string) => {
                updateState('music', state.allMusic.filter(
                    file => file.title.toLowerCase().includes(search.toLowerCase()) || file.artist.toLowerCase().includes(search.toLowerCase())
                ));
            }} onUISwitch={() => {
                updatePlaylistState('isPlaylistUI', !playlistState.isPlaylistUI);
            }} onMusicPlayerVisible={() => {
                updatePlaylistState('isMusicPlayerVisible', !playlistState.isMusicPlayerVisible);
            }} />
        </>
    )
}

export const Bludclart = withAuth(oblockpage);
