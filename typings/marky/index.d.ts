declare module 'marky' {
    export function mark(name: string): void;
    export function stop(name: string): PerformanceEntry;
    export function getEntries(): PerformanceEntry[];
}
