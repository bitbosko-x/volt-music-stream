import React from 'react';

export function AnimatedLogo({ className = "h-10 w-10", isPlaying = true }) {
    // Reference Image: Left side EQ bars (Orange/Yellow), Right side half vinyl (White)
    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full drop-shadow-[0_0_15px_rgba(255,100,0,0.5)]"
            >
                <defs>
                    <linearGradient id="eqGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#ff3300" />
                        <stop offset="50%" stopColor="#ff7b00" />
                        <stop offset="100%" stopColor="#ffcc00" />
                    </linearGradient>
                    <style>
                        {`
              @keyframes spin-vinyl {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .spin-vinyl { transform-origin: 50px 50px; animation: ${isPlaying ? 'spin-vinyl 4s linear infinite' : 'none'}; }
            `}
                    </style>

                    <clipPath id="leftHalf">
                        <rect x="0" y="0" width="50" height="100" />
                    </clipPath>
                    <clipPath id="rightHalf">
                        <rect x="50" y="0" width="50" height="100" />
                    </clipPath>
                </defs>

                {/* --- LEFT SIDE: EQ BARS --- */}
                {/* We use dashed strokes to simulate the blocky EQ meter from the image */}
                <g stroke="url(#eqGradient)" strokeWidth="10" strokeDasharray="8 4" strokeLinecap="square">
                    <line x1="15" y1="50" x2="15" y2="90" />
                    <line x1="30" y1="20" x2="30" y2="90" />
                    <line x1="45" y1="35" x2="45" y2="90" />
                </g>

                {/* Fill in the gaps at the bottom to ground it */}
                <rect x="10" y="86" width="10" height="8" fill="#ff3300" />
                <rect x="25" y="86" width="10" height="8" fill="#ff3300" />
                <rect x="40" y="86" width="10" height="8" fill="#ff3300" />

                {/* --- RIGHT SIDE: HALF VINYL --- */}
                <g clipPath="url(#rightHalf)">
                    <g className="spin-vinyl">
                        {/* Base Vinyl */}
                        <circle cx="50" cy="50" r="40" fill="white" />

                        {/* Inner Grooves */}
                        <circle cx="50" cy="50" r="32" fill="none" stroke="#f0f0f0" strokeWidth="1" />
                        <circle cx="50" cy="50" r="28" fill="none" stroke="#e0e0e0" strokeWidth="2" />
                        <circle cx="50" cy="50" r="23" fill="none" stroke="#d0d0d0" strokeWidth="1.5" />

                        {/* Center Hole Array */}
                        <circle cx="50" cy="50" r="14" fill="#09090b" />
                        <circle cx="50" cy="50" r="4" fill="white" />
                    </g>
                </g>

                {/* Central visual separator blending the EQ into the vinyl */}
                <line x1="50" y1="10" x2="50" y2="90" stroke="#09090b" strokeWidth="4" />
            </svg>
        </div>
    );
}
