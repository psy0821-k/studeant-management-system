import type { HTMLAttributes } from 'react'

function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${className}`}
      {...props}
    />
  )
}

export default Card
