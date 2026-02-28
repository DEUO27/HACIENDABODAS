"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const GlowingCard = ({
    children,
    className,
    glowColor = "#3b82f6",
    hoverEffect = true,
    enableGlow = true,
    glowRadius = 15,
    glowOpacity = 1,
    animationDuration = 400,
    ...props
}) => {
    const cardRef = useRef(null);
    const overlayRef = useRef(null);
    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
        const card = cardRef.current;
        const overlay = overlayRef.current;

        if (!card || !overlay || !enableGlow) return;

        const handleMouseMove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setShowOverlay(true);

            overlay.style.setProperty('--x', x + 'px');
            overlay.style.setProperty('--y', y + 'px');
            overlay.style.setProperty('--opacity', glowOpacity.toString());
        };

        const handleMouseLeave = () => {
            setShowOverlay(false);
            overlay.style.setProperty('--opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            card.removeEventListener('mousemove', handleMouseMove);
            card.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [enableGlow, glowOpacity]);

    return (
        <div
            ref={cardRef}
            className={cn(
                "relative flex flex-col transition-all duration-400 ease-out",
                className
            )}
            style={{
                '--glow-color': glowColor,
                '--animation-duration': animationDuration + 'ms',
                '--glow-radius': glowRadius + 'rem',
                boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
            }}
            {...props}
        >
            {/* Primary Children rendering */}
            {children}

            {/* Overlay for glow effect constrained to THIS specific card */}
            {enableGlow && (
                <div
                    ref={overlayRef}
                    className={cn(
                        "absolute inset-0 pointer-events-none select-none rounded-[inherit]",
                        "opacity-0 transition-opacity duration-[var(--animation-duration)] ease-out"
                    )}
                    style={{
                        WebkitMask: "radial-gradient(var(--glow-radius) var(--glow-radius) at var(--x, 0) var(--y, 0), #000 1%, transparent 50%)",
                        mask: "radial-gradient(var(--glow-radius) var(--glow-radius) at var(--x, 0) var(--y, 0), #000 1%, transparent 50%)",
                        opacity: showOverlay ? 'var(--opacity)' : '0',
                        zIndex: 10,
                    }}
                >
                    {/* The glowing border box itself */}
                    <div
                        className={cn(
                            "absolute inset-0 rounded-[inherit] border",
                            "bg-opacity-15 dark:bg-opacity-15",
                            "border-opacity-100 dark:border-opacity-100",
                            "bg-transparent dark:bg-transparent"
                        )}
                        style={{
                            backgroundColor: glowColor + "15",
                            borderColor: glowColor,
                            boxShadow: "0 0 0 1px inset " + glowColor,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export const GlowingCards = ({
    children,
    className,
    ...props
}) => {
    return (
        <div className={cn("relative w-full", className)} {...props}>
            {children}
        </div>
    );
};
