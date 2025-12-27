import React from 'react';

export default function EmptyState({
    icon = "📭",
    title = "No items",
    description = "Nothing to show here yet.",
    action = null
}) {
    return (
        <div className="empty-state fade-in-up" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-2xl)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            minHeight: '300px'
        }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>
                {icon}
            </div>
            <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>{title}</h3>
            <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto var(--spacing-lg)' }}>
                {description}
            </p>
            {action && (
                <button
                    className="btn btn-primary"
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
