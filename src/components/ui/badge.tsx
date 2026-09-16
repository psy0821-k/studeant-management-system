import type { HTMLAttributes } from 'react'

type BadgeTone = 'gray' | 'success' | 'warning' | 'error' | 'info' | 'primary'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_STYLES: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  error: 'bg-error-50 text-error-700',
  info: 'bg-info-50 text-info-700',
  primary: 'bg-primary-100 text-primary-700',
}

function Badge({ tone = 'gray', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${TONE_STYLES[tone]} ${className}`}
      {...props}
    />
  )
}

export default Badge
