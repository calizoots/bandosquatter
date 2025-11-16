import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import './error.scss'

type BsErrorProps = {
    message: string;
    onClose: () => void;
    duration?: number;
    isOkay?: boolean
};

export const BsError = ({ message, onClose, duration = 3000, isOkay }: BsErrorProps) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setShow(true));

        const timeout = setTimeout(() => setShow(false), duration);

        return () => clearTimeout(timeout);
    }, []);

    const handleTransitionEnd = () => {
        if (!show) onClose();
    };

    return (
        <div className={`bs-error-wrapper ${show ? "show" : ""}`} onTransitionEnd={handleTransitionEnd}>
            <div className="bs-error-card">
                {isOkay ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="bs-error-icon" viewBox="0 -960 960 960">
                        <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="bs-error-icon" viewBox="0 -960 960 960">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
                    </svg>
                )}
                <span>{message}</span>
            </div>
        </div>
    )
}

type ErrorType = { id: string; message: string, isOkay?: boolean };

type ErrorContextType = {
    pushError: (msg: string, isOkay?: boolean) => void;
};

const ErrorContext = createContext<ErrorContextType | null>(null);

export const useError = () => {
    const context = useContext(ErrorContext);
    if (!context) throw new Error('useError must be used within an ErrorProvider');
    return context;
};

export const ErrorProvider = ({ children }: { children: preact.ComponentChildren }) => {
    const [errors, setErrors] = useState<ErrorType[]>([]);

    const pushError = (msg: string, isOkay?: boolean) => {
        setErrors(prev => {
            const updated = [...prev, { id: crypto.randomUUID(), message: msg, isOkay: isOkay }];
            if (updated.length > 3) updated.shift();
            return updated;
        });
    };

    return (
        <ErrorContext.Provider value={{ pushError }}>
            {children}
            <div style={{
                position: 'fixed',
                height: '100vh',
                top: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
            }}>
                {errors.map(error => (
                    <BsError
                        key={error.id}
                        message={error.message}
                        isOkay={error.isOkay}
                        duration={3000}
                        onClose={() =>
                            setErrors(prev => prev.filter(e => e.id !== error.id))
                        }
                    />
                ))}
            </div>
        </ErrorContext.Provider>
    );
};
