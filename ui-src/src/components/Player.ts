import { type MusicRow } from '../routes/bludclart.tsx';
import { HOSTNAME } from '../global.ts';

let queueCounterIncrement = 0;

export type QueueType = {
    id: number;
    file: string;
    object: MusicRow;
};

type CurrentSong420 = {
    object?: (MusicRow & { songDuration: number });
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
    referenceSong: MusicRow | undefined = undefined;
    isPlaying: boolean = false;
    queue: QueueType[] = [];
    shuffle: boolean = false;
    shuffledting: QueueType[] = [];
    previous: QueueType[] = []
    crossfadeDuration = 3000
    onQueueUpdate: (() => void) | null = null;

    constructor() {
        this.audioPlayer = new Audio();

        this.audioPlayer.addEventListener('ended', () => {
            this.playNextSong();
        });
    }

    expandUrl(thing: string) {
        return `${HOSTNAME}${thing}`;
    }

    setTime(time: number) {
        if (this.audioPlayer?.currentTime) {
            this.audioPlayer.currentTime = time;
        }
    }

    async bang(song: MusicRow) {
        if (this.shuffle) {
            if (this.queue.length > 0) {
                this.shuffleQueue()
                song = this.shuffledting[0].object
            }
        }
        if (this.currentSong.object !== undefined) {
            this.previous.push({ id: queueCounterIncrement, file: this.currentSong.url, object: this.currentSong.object })
            queueCounterIncrement += 1
        }
        if (this.referenceSong === song) {
            this.toggleSong(song.location);
        } else {
            this.toggleSong(song.location);
            if (this.audioPlayer) {
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: song.title,
                        artist: song.artist,
                        album: song.album,
                        artwork: [{ src: this.expandUrl(song.cover_location), sizes: '512x512', type: 'image/jpeg' }],
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
            }
            this.currentSong.url = song.location;
            this.currentSong.object = {
                userid: song.userid,
                backend: song.backend,
                size: song.size,
                id: song.id,
                date_added: song.date_added,
                title: song.title,
                artist: song.artist,
                album: song.album,
                cover_location: song.cover_location,
                location: song.location,
                songDuration: this.audioPlayer.duration,
            };
        }
    }

    async playFile(url: string) {
        this.isPlaying = true;
        this.currentSong.url = url;

        try {
            const res = await fetch(this.expandUrl(url), {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) {
                throw new Error(`failed to fetch audio: ${res.statusText}`);
            }

            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);

            this.audioPlayer.src = objectUrl;
            await this.audioPlayer.play();

            this.audioPlayer.onloadedmetadata = () => {
                this.currentSong.duration = this.audioPlayer.duration;
            };
        } catch (err) {
            console.error("error playing file:", err);
        }
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

    addToQueue(file: MusicRow) {
        this.queue.push({
            file: file.location,
            id: queueCounterIncrement,
            object: file,
        });
        if (this.shuffle) {
            this.shuffleQueue();
        }
        queueCounterIncrement += 1
        this.triggerQueueUpdate()
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
