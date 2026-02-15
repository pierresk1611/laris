import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
    progress: number; // 0 to 100
    label?: string;
    showPercentage?: boolean;
    className?: string;
    colorClass?: string;
}

export function ProgressBar({
    progress,
    label,
    showPercentage = true,
    className,
    colorClass = "bg-blue-600"
}: ProgressBarProps) {
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className={cn("w-full", className)}>
            {(label || showPercentage) && (
                <div className="flex justify-between items-center mb-1 text-xs font-semibold text-slate-600">
                    {label && <span>{label}</span>}
                    {showPercentage && <span>{Math.round(clampedProgress)}%</span>}
                </div>
            )}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                    className={cn("h-2.5 rounded-full transition-all duration-500 ease-out", colorClass)}
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>
        </div>
    );
}
