export interface AnimeMetadata {
  seasonNumber: number | null;
  episodeNumber: number | null;
  resolution: string | null;
  audioLanguage: string | null;
  isAnimeEpisode: boolean;
  cleanEpisodeLabel: string | null;
}

export function parseAnimeFilename(filename: string, contextPath?: string | null): AnimeMetadata {
  const extIndex = filename.lastIndexOf('.');
  const baseName = extIndex !== -1 ? filename.substring(0, extIndex) : filename;

  let seasonNumber: number | null = null;
  let episodeNumber: number | null = null;
  let resolution: string | null = null;
  let audioLanguage: string | null = null;

  // 1. Detect Resolution
  const resMatch = baseName.match(/(2160p|4k|1080p|720p|480p|576p|360p)/i);
  if (resMatch) {
    resolution = resMatch[1].toUpperCase() === '4K' ? '4K' : resMatch[1].toLowerCase();
  }

  // 2. Detect Audio / Language Dub
  if (/hindi.*dub|hindi-dub|hindi/i.test(baseName)) {
    audioLanguage = 'Hindi Dub';
  } else if (/dual.*audio|dual-audio/i.test(baseName)) {
    audioLanguage = 'Dual Audio';
  } else if (/multi.*audio|multi-audio/i.test(baseName)) {
    audioLanguage = 'Multi Audio';
  } else if (/eng.*dub|english.*dub|english/i.test(baseName)) {
    audioLanguage = 'English Dub';
  } else if (/jap.*sub|japanese|subbed/i.test(baseName)) {
    audioLanguage = 'Japanese Sub';
  }

  // 3. Detect Season & Episode
  // Case A: S01E02 or S1E2 or S03E02 or S3E2 or s01e10 or S01_E02 or S1-E2
  const sPattern = /\bS(\d{1,2})\s*[-._ ]*E(\d{1,4}(?:\.\d+)?)\b/i;
  const sMatch = baseName.match(sPattern);
  if (sMatch) {
    seasonNumber = parseInt(sMatch[1], 10);
    episodeNumber = parseFloat(sMatch[2]);
  }

  // Case B: "Season 1 Episode 2" or "Season 02 - 04" or "Season 1 - Ep 2" or "S1 - E2"
  if (episodeNumber === null) {
    const seasonEpPattern = /(?:Season|S)\s*(\d{1,2})\s*[-._ ]*(?:Episode|Ep|E)\s*(\d{1,4}(?:\.\d+)?)/i;
    const match = baseName.match(seasonEpPattern);
    if (match) {
      seasonNumber = parseInt(match[1], 10);
      episodeNumber = parseFloat(match[2]);
    }
  }

  // Case C: Just Episode: "EP01", "EP 01", "EP_01", "Ep.03", "Episode 10", "Episode_01", "Episode-01", "E01", "E1", "E 01", "E_01"
  if (episodeNumber === null) {
    const epPattern = /\b(?:Episode|EP|Ep|E)\s*[-._ ]*(\d{1,4}(?:\.\d+)?)\b/i;
    const match = baseName.match(epPattern);
    if (match) {
      episodeNumber = parseFloat(match[1]);
    }
  }

  // Case D: Anime fansub standard: "[Fansub] Show Title - 04 [1080p].mkv"
  if (episodeNumber === null) {
    const fansubPattern = /(?:^|[\s_\]\)])[-_ ]+(\d{1,4}(?:\.\d+)?)(?:[\s_\[\(]|$)/;
    const match = baseName.match(fansubPattern);
    if (match) {
      const epVal = parseFloat(match[1]);
      // Safety filter: make sure it's not a resolution (720, 1080, 2160, 480, 360) or year (1950-2050)
      if (
        epVal !== 720 &&
        epVal !== 1080 &&
        epVal !== 2160 &&
        epVal !== 480 &&
        epVal !== 360 &&
        (epVal < 1950 || epVal > 2050)
      ) {
        episodeNumber = epVal;
      }
    }
  }

  // Check if Season was specified elsewhere in filename or in contextPath (e.g. "Season 2" or "S2")
  if (seasonNumber === null) {
    const searchTarget = `${baseName} ${contextPath || ''}`;
    const seasonMatch = searchTarget.match(/\b(?:Season|S)\s*[-._ ]*(\d{1,2})\b/i);
    if (seasonMatch) {
      seasonNumber = parseInt(seasonMatch[1], 10);
    } else if (episodeNumber !== null) {
      // Default to Season 1 if an episode is identified but season is unspecified
      seasonNumber = 1;
    }
  }

  // Check if it's a known non-video file (like poster, cover, info, nfo, srt, trailer)
  const isVideoExt = /\.(mkv|mp4|webm|avi|mov|m4v|ts|flv)$/i.test(filename);
  const isOther = /\b(trailer|preview|sample|teaser|poster|cover|banner|ost|theme|nfo|txt|sub|idx)\b/i.test(baseName);

  const isAnimeEpisode = isVideoExt && !isOther && episodeNumber !== null;

  let cleanEpisodeLabel: string | null = null;
  if (isAnimeEpisode && episodeNumber !== null) {
    const formattedEp = episodeNumber < 10 && episodeNumber % 1 === 0 ? `0${episodeNumber}` : `${episodeNumber}`;
    cleanEpisodeLabel = `Episode ${formattedEp}`;
  }

  return {
    seasonNumber,
    episodeNumber,
    resolution,
    audioLanguage,
    isAnimeEpisode,
    cleanEpisodeLabel,
  };
}
