interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  className?: string
  count?: number
}

function SkeletonBase({
  variant = 'text',
  width,
  height,
  className = '',
}: Omit<SkeletonProps, 'count'>) {
  const resolvedWidth =
    typeof width === 'number' ? `${width}px` : width
  const resolvedHeight =
    typeof height === 'number' ? `${height}px` : height

  const variantStyles: Record<string, React.CSSProperties> = {
    text: {
      width: resolvedWidth ?? '100%',
      height: resolvedHeight ?? '1em',
      borderRadius: '6px',
    },
    circular: {
      width: resolvedWidth ?? '48px',
      height: resolvedHeight ?? '48px',
      borderRadius: '50%',
    },
    rectangular: {
      width: resolvedWidth ?? '100%',
      height: resolvedHeight ?? '120px',
      borderRadius: '8px',
    },
    card: {
      width: resolvedWidth ?? '100%',
      height: resolvedHeight ?? 'auto',
      borderRadius: '12px',
      padding: '1.5rem',
      border: '1px solid var(--border-color)',
    },
  }

  if (variant === 'card') {
    return (
      <div
        className={`skeleton-card ${className}`}
        style={{
          ...variantStyles.card,
          background: 'var(--bg-card)',
        }}
      >
        {/* Icon placeholder */}
        <div
          className="skeleton-shimmer"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            marginBottom: '1rem',
          }}
        />
        {/* Title placeholder */}
        <div
          className="skeleton-shimmer"
          style={{
            width: '60%',
            height: '0.875rem',
            borderRadius: '6px',
            marginBottom: '0.75rem',
          }}
        />
        {/* Value placeholder */}
        <div
          className="skeleton-shimmer"
          style={{
            width: '80%',
            height: '1.75rem',
            borderRadius: '6px',
            marginBottom: '0.5rem',
          }}
        />
        {/* Subtitle placeholder */}
        <div
          className="skeleton-shimmer"
          style={{
            width: '40%',
            height: '0.75rem',
            borderRadius: '6px',
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={variantStyles[variant]}
    />
  )
}

export default function Skeleton({
  count = 1,
  ...props
}: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBase key={i} {...props} />
      ))}

      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            var(--bg-card) 25%,
            var(--bg-elevated, #334155) 50%,
            var(--bg-card) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }

        .skeleton-card {
          animation: skeleton-pulse 2s ease-in-out infinite;
        }

        @keyframes skeleton-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  )
}
