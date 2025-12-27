import React from 'react';

export default function LoadingState({ text = "Loading..." }) {
    return (
        <div className="loading-container" style={{ padding: 'var(--spacing-2xl)' }}>
            <div className="spinner"></div>
            <p className="text-muted mt-md">{text}</p>
        </div>
    );
}
