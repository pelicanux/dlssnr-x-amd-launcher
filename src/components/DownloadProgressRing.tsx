export function DownloadProgressRing({ percent, size = 28 }: { percent: number; size?: number }) {
  const progress = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return <svg className="download-progress-ring" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <circle className="download-progress-track" cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1.8"/>
    <circle className="download-progress-fill" cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1.8"
      pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} strokeLinecap={progress > 0 ? "round" : "butt"} transform="rotate(-90 14 14)"/>
  </svg>;
}
