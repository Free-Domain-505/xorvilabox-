export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

export function formatSizeComparison(loaded: number, total: number): string {
  if (total <= 0) {
    return formatBytes(loaded);
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(total)) / Math.log(k)), sizes.length - 1);
  const unit = sizes[i];
  const totalInUnit = (total / Math.pow(k, i)).toFixed(2);
  const loadedInUnit = (loaded / Math.pow(k, i)).toFixed(2);
  return `${loadedInUnit} ${unit} / ${totalInUnit} ${unit}`;
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0 || isNaN(bps)) return '0 B/s';
  const k = 1024;
  if (bps >= k * k * k) {
    return `${(bps / (k * k * k)).toFixed(1)} GB/s`;
  }
  if (bps >= k * k) {
    return `${(bps / (k * k)).toFixed(1)} MB/s`;
  }
  if (bps >= k) {
    return `${(bps / k).toFixed(0)} KB/s`;
  }
  return `${Math.round(bps)} B/s`;
}

export function formatTimeRemaining(remainingBytes: number, speedBps: number): string {
  if (!speedBps || speedBps <= 0 || isNaN(speedBps) || remainingBytes <= 0 || isNaN(remainingBytes)) {
    return 'Calculating time remaining...';
  }

  const seconds = remainingBytes / speedBps;
  if (isNaN(seconds) || !isFinite(seconds)) {
    return 'Calculating time remaining...';
  }

  if (seconds < 1) {
    return 'Less than a second';
  }

  if (seconds < 60) {
    const s = Math.round(seconds);
    return `${s} sec remaining`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (secs === 0) {
      return `${minutes} min remaining`;
    }
    return `${minutes} min ${secs} sec remaining`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (minutes === 0) {
    return `${hours} hr remaining`;
  }
  return `${hours} hr ${minutes} min remaining`;
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function getEpisodeBadge(season: number | null, episode: number | null): string {
  if (episode === null) return '';
  const epFormatted = episode < 10 && episode % 1 === 0 ? `0${episode}` : `${episode}`;
  if (season !== null && season > 1) {
    return `S${season < 10 ? '0' + season : season} EP${epFormatted}`;
  }
  return `EPISODE ${epFormatted}`;
}

// Rolling speed calculator helper to prevent wild spikes
export class SpeedSmoother {
  private history: Array<{ timestamp: number; loaded: number }> = [];
  private currentSmoothedSpeed = 0;
  private readonly windowMs: number;

  constructor(windowMs = 2500) {
    this.windowMs = windowMs;
  }

  public update(loaded: number): number {
    const now = Date.now();
    this.history.push({ timestamp: now, loaded });

    // Remove points older than windowMs
    while (this.history.length > 1 && now - this.history[0].timestamp > this.windowMs) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return this.currentSmoothedSpeed;
    }

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000;

    if (timeDiff > 0.2) {
      const bytesDiff = Math.max(0, last.loaded - first.loaded);
      const instantSpeed = bytesDiff / timeDiff;

      // Exponential moving average filter with weight 0.35
      if (this.currentSmoothedSpeed === 0) {
        this.currentSmoothedSpeed = instantSpeed;
      } else {
        this.currentSmoothedSpeed = 0.35 * instantSpeed + 0.65 * this.currentSmoothedSpeed;
      }
    }

    return this.currentSmoothedSpeed;
  }

  public getSpeed(): number {
    return this.currentSmoothedSpeed;
  }
}
