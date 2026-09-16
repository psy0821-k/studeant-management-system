interface FlipDigitsProps {
  value: string
  className?: string
}

function FlipDigits({ value, className = '' }: FlipDigitsProps) {
  return (
    <span className={`relative inline-block overflow-hidden ${className}`}>
      <span key={value} className="inline-block animate-flip-in">
        {value}
      </span>
    </span>
  )
}

export default FlipDigits
