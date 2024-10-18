import { musicFile, QueueType } from '../components/MusicPlayer';

export type UserData = {
    id: number;
    createdAt: string;
    updatedAt: string;
    username: string;
    password: string;
    musicFolder: string;
    profilePicture: string;
};

export type playlistType = {
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
    }[];
};

type State = {
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
        visible: boolean;
        selectedPlaylist?: playlistType;
    };
    newPlayListValue: string;
    updatetofixsumbrokenshi: boolean;
    songsSortOption: string;
    isUserAddingSongToPlaylist: {
        isit: boolean;
        playlist?: playlistType;
    };
    isUserRemovingSongFromPlaylist: {
        isit: boolean;
        playlist?: playlistType;
    };
};

export let profileMenuButtonStyle: React.JSX.CSSProperties = { backgroundColor: 'transparent', cursor: 'pointer' };

export default State;

