import { musicFile, QueueType } from "../MusicPlayer";

let queueCounterIncrement = 0;

type CurrentSong420 = {
    object?: (musicFile & { songDuration: number });
    url: string;
    duration: number;
};

export default class Player {
    audioPlayer: HTMLAudioElement;
    currentSong: CurrentSong420 = {
        object: undefined,
        url: "",
        duration: 0
    };
    referenceSong: musicFile | undefined = undefined;
    isPlaying: boolean = false;
    queue: QueueType[] = [];
    shuffle: boolean = false;
    shuffledting: QueueType[] =[];
    previous: QueueType[] =[]
    crossfadeDuration = 3000
    onQueueUpdate: (() => void) | null = null;

    constructor() {
        this.audioPlayer = new Audio();

        this.audioPlayer.addEventListener('ended', () => {
            this.playNextSong();
        });
    }

    setTime(time: number) {
        if (this.audioPlayer?.currentTime) {
            this.audioPlayer.currentTime = time;
        }
    }

    bang(song: musicFile) {
        if (this.shuffle) {
            if (this.queue.length > 0) {
                this.shuffleQueue()
                song = this.shuffledting[0].object
            }
        }
        if (this.currentSong.object !== undefined) {
            this.previous.push({id: queueCounterIncrement, file: this.currentSong.url, object: this.currentSong.object})
            queueCounterIncrement += 1
        }
        if (this.referenceSong === song) {
            this.toggleSong(song.url);
        } else {
            this.toggleSong(song.url);
            if (this.audioPlayer)
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: song.title,
                        artist: song.artist,
                        album: song.album,
                        artwork: [
                            { src: song.albumArt, sizes: '512x512', type: 'image/jpeg' }
                        ]
                    });
        
                    navigator.mediaSession.setActionHandler('play', () => {
                        this.audioPlayer.play();
                    });
                    navigator.mediaSession.setActionHandler('pause', () => {
                        this.audioPlayer.pause();
                    });

                    navigator.mediaSession.setActionHandler('nexttrack', () => {
                        this.playNextSong();
                    });
                
                    navigator.mediaSession.setActionHandler('previoustrack', () => {
                        this.playPreviousSong();
                    });
                }
                this.currentSong.url = song.url;
                this.currentSong.object = {
                    id: song.id,
                    createdAt: song.createdAt,
                    updatedAt: song.updatedAt,
                    title: song.title,
                    artist: song.artist,
                    album: song.album,
                    albumArt: song.albumArt,
                    url: song.url,
                    fileName: song.fileName,
                    songDuration: this.audioPlayer.duration,
                };
        }
    }

    playFile(url: string) {
        this.isPlaying = true;
        this.currentSong.url = url;
        this.audioPlayer.src = url;
        this.audioPlayer.load();
        this.audioPlayer.play();
        this.currentSong.duration = this.audioPlayer.duration;
    }

    toggleSong(url: string) {
        if (this.currentSong.url == url && this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
        } else if (this.currentSong.url == url && !this.isPlaying) {
            this.audioPlayer.play();
            this.isPlaying = true;
        } else if (this.currentSong.url !== url) {
            if (this.audioPlayer) {
                this.audioPlayer.pause();
            }
            this.playFile(url);
        }
    }

    addToQueue(file: musicFile) {
        this.queue.push({
            file: file.url,
            id: queueCounterIncrement,
            object: file,
        });
        if (this.shuffle) {
            this.shuffleQueue();
        }
        queueCounterIncrement += 1
        this.triggerQueueUpdate();
    }

    removeFromQueue(id: number) {
        const index = this.queue.findIndex(queuething => queuething.id === id);
        if (index !== -1) {
            this.previous.push(this.queue[index])
            this.queue.splice(index, 1);
            this.triggerQueueUpdate();
        }
        this.triggerQueueUpdate();
    }

    // ai so this is called the fisher yates search algorthim n nat
    // chat gpt told me bout dis so big up
    // but fucking smart shuffle spotify up my ass
    // like man can get an answer on chat gpt pussy sym dickface
    shuffleQueue() {
        this.shuffledting = [...this.queue];
        for (let i = this.shuffledting.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledting[i], this.shuffledting[j]] = [this.shuffledting[j], this.shuffledting[i]];
        }
    }

    playNextSong() {
        if (this.queue.length > 0) {
            let nextSong: QueueType | undefined;

            if (this.shuffle) {
                if (this.shuffledting.length === 0) {
                    this.shuffleQueue();
                }
    
                const nextSong = this.shuffledting.shift();
    
                if (nextSong) {
                    this.bang(nextSong.object);
                    this.triggerQueueUpdate();
                }
            } else {
                nextSong = this.queue.shift();
            }
    
            if (nextSong) {
                this.bang(nextSong.object);
                this.triggerQueueUpdate();
                this.fadeIn(this.audioPlayer)
            }
        }
    }

    playPreviousSong() {
        if (this.previous.length > 0) {
            const prevSong = this.previous.shift();
            if (prevSong) {
                this.bang(prevSong.object)
                this.triggerQueueUpdate()
            }
        }
    }
    
    fadeOut(audio: HTMLAudioElement) {
        const fadeStep = 0.05;
        const fadeInterval = this.crossfadeDuration / 20; 

        const fadeOutInterval = setInterval(() => {
            if (audio.volume > 0) {
                audio.volume = Math.max(0, audio.volume - fadeStep);
            } else {
                clearInterval(fadeOutInterval);
            }
        }, fadeInterval);
    }

    fadeIn(audio: HTMLAudioElement) {
        const fadeStep = 0.05;
        const fadeInterval = this.crossfadeDuration / 20;

        const fadeInInterval = setInterval(() => {
            if (audio.volume < 1) {
                audio.volume = Math.min(1, audio.volume + fadeStep);
            } else {
                clearInterval(fadeInInterval);
            }
        }, fadeInterval);
    }

    triggerQueueUpdate() {
        if (this.onQueueUpdate) {
            this.onQueueUpdate();
        }
    }
}