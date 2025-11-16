import { useEffect, useRef } from 'preact/hooks';
import Player from './Player.ts';
import './Queue.scss';

interface QueueProps {
    player: Player;
    isVisible: boolean;
}

let Queue: React.FC<QueueProps> = (props: QueueProps) => {
    const queueRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = (event: WheelEvent) => {
            if (!queueRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = queueRef.current;
            const atTop = scrollTop === 0;
            const atBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

            const goingUp = event.deltaY < 0;
            const goingDown = event.deltaY > 0;

            if ((atTop && goingUp) || (atBottom && goingDown)) {
                event.preventDefault();
            } else {
                event.stopPropagation();
            }
        };

        const wrapper = queueRef.current;
        if (wrapper) {
            wrapper.addEventListener("wheel", handleScroll, { passive: false });
        }
        return () => {
            if (wrapper) {
                wrapper.removeEventListener("wheel", handleScroll);
            }
        };
    }, []);

    let showQueue = !props.player.shuffle ? (
        // for normal queue
        props.player.queue.length > 0 ? (
            props.player.queue.map(song => (
                <div style={{ display: 'flex', flexDirection: 'column' }} className="queue-inner-wrapper">
                    <span className="queue-song-name">{song.object.title}</span>
                    <div onClick={() => props.player.removeFromQueue(song.id)}>
                        <span style={{ fontSize: '12px' }} className="queue-remove-song">
                            remove?
                        </span>
                    </div>
                </div>
            ))
        ) : (
            <div className="queue-inner-wrapper">
                <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
            </div>
        )
    ) : // for shuffle queue
        // ik this comment seem real fucking basic but small change and i smoke weed
        props.player.shuffledting.length > 0 ? (
            props.player.shuffledting.map(song => (
                <div style={{ display: 'flex', flexDirection: 'column' }} className="queue-inner-wrapper">
                    <span className="queue-song-name">{song.object.title}</span>
                    <span style={{ fontSize: '12px' }} className="queue-remove-song" onClick={() => props.player.removeFromQueue(song.id)}>
                        remove?
                    </span>
                </div>
            ))
        ) : (
            <div className="queue-inner-wrapper">
                <span className="queue-message-nothing">🙉 aint nun to see here 🙉</span>
            </div>
        );

    return (
        <>
            {props.isVisible ? (
                <div className={`queue-wrapper`} ref={queueRef}>
                    {/* cuz thats neccersarry im so tired */}
                    {/* <div className={`queue-inner-wrapper ${props.state.graphicalMode ? '' : 'margin-fix-other-ui'}`}>{showQueue}</div> */}
                    {showQueue}
                </div>
            ) : null}
        </>
    );
};

export default Queue;
