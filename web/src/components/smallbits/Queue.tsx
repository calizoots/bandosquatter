import { useEffect, useRef } from 'preact/hooks';
import type State from '../../types/bludclart';
import Player from '../MusicPlayerThatPlaysMusic';
import '../styles/Queue.scss';

interface QueueProps {
    player: Player;
    state: State;
}

let Queue: React.FC<QueueProps> = (props: QueueProps) => {
    const queueInnerRef = useRef<HTMLDivElement>(null);

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

    let showQueue = !props.player.shuffle ? (
        // for normal queue
        props.player.queue.length > 0 ? (
            props.player.queue.map(song => (
                <div style={{ display: 'flex', flexDirection: 'column' }} className="queue-inner-wrapper" ref={queueInnerRef}>
                    <span className="queue-song-name">{song.file.split(`${props.state.userData?.username}/`)[1].replace('.mp3', '')}</span>
                    <span style={{ fontSize: '12px' }} className="queue-remove-song" onClick={() => props.player.removeFromQueue(song.id)}>
                        remove?
                    </span>
                </div>
            ))
        ) : (
            <div className="queue-inner-wrapper" style={{ textAlign: 'center' }}>
                <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
            </div>
        )
    ) : // for shuffle queue
    // ik this comment seem real fucking basic but small change and i smoke weed
    props.player.shuffledting.length > 0 ? (
        props.player.shuffledting.map(song => (
            <div style={{ display: 'flex', flexDirection: 'column' }} className="queue-inner-wrapper" ref={queueInnerRef}>
                <span className="queue-song-name">{song.file.split(`${props.state.userData?.username}/`)[1].replace('.mp3', '')}</span>
                <span style={{ fontSize: '12px' }} className="queue-remove-song" onClick={() => props.player.removeFromQueue(song.id)}>
                    remove?
                </span>
            </div>
        ))
    ) : (
        <div className="queue-inner-wrapper" style={{ textAlign: 'center' }}>
            <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
        </div>
    );

    return (
        <>
            {props.state.isQueueVisible ? (
                <div className={`queue-wrapper`}>
                    {/* cuz thats neccersarry im so tired */}
                    <div className={`queue-inner-wrapper ${props.state.graphicalMode ? '' : 'margin-fix-other-ui'}`}>{showQueue}</div>
                </div>
            ) : null}
        </>
    );
};

export default Queue;

