import type React from "react"
import { PeaceIcon } from "./peace-icon"

interface CoinIconProps {
  className?: string
  size?: number
}

export const CoinIcon: React.FC<CoinIconProps> = ({ className = "", size = 24 }) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Coin circle */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
      </svg>

      {/* Peace branch inside */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: "scale(0.7)" }}>
        <PeaceIcon size={size} />
      </div>
    </div>
  )
}
