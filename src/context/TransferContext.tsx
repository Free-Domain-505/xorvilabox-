import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { type TransferItem, type TransferType, type TransferStatus } from '../types.js';
import { SpeedSmoother } from '../utils/format.js';

interface TransferContextType {
  transfers: TransferItem[];
  activeTransfers: TransferItem[];
  completedTransfers: TransferItem[];
  failedTransfers: TransferItem[];
  isManagerOpen: boolean;
  setIsManagerOpen: (open: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  activeTab: 'active' | 'completed' | 'failed';
  setActiveTab: (tab: 'active' | 'completed' | 'failed') => void;
  openManager: (tab?: 'active' | 'completed' | 'failed') => void;
  closeManager: () => void;
  toggleMinimize: () => void;
  startUpload: (
    file: File,
    folderId: string | null,
    folderUid: string | null,
    folderName: string,
    duplicateMode?: 'replace' | 'keep_both' | null
  ) => string;
  startUrlImport: (
    url: string,
    folderId: string | null,
    folderUid: string | null,
    folderName: string
  ) => Promise<string>;
  startZipImport: (
    zipFile: File,
    folderId: string | null,
    folderUid: string | null,
    folderName: string
  ) => Promise<string>;
  cancelTransfer: (id: string) => Promise<void>;
  retryTransfer: (id: string) => void;
  removeTransfer: (id: string) => void;
  clearCompleted: () => void;
  subscribeCompleted: (callback: (item: TransferItem) => void) => () => void;
}

const TransferContext = createContext<TransferContextType | null>(null);

export function useTransfers() {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error('useTransfers must be used within a TransferProvider');
  }
  return context;
}

export const TransferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'failed'>('active');

  // References to active abort controllers / XHR / SSE
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const eventSourceMapRef = useRef<Map<string, EventSource>>(new Map());
  const pollIntervalMapRef = useRef<Map<string, number>>(new Map());
  const speedSmoothersRef = useRef<Map<string, SpeedSmoother>>(new Map());
  const retryDataRef = useRef<Map<string, () => void>>(new Map());
  const completedListenersRef = useRef<Set<(item: TransferItem) => void>>(new Set());

  const subscribeCompleted = useCallback((callback: (item: TransferItem) => void) => {
    completedListenersRef.current.add(callback);
    return () => {
      completedListenersRef.current.delete(callback);
    };
  }, []);

  const notifyCompleted = useCallback((item: TransferItem) => {
    completedListenersRef.current.forEach((cb) => {
      try { cb(item); } catch (e) { console.error('Transfer complete listener error', e); }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      xhrMapRef.current.forEach((xhr) => xhr.abort());
      eventSourceMapRef.current.forEach((es) => es.close());
      pollIntervalMapRef.current.forEach((t) => window.clearInterval(t));
    };
  }, []);

  const openManager = useCallback((tab?: 'active' | 'completed' | 'failed') => {
    if (tab) setActiveTab(tab);
    setIsManagerOpen(true);
    setIsMinimized(false);
  }, []);

  const closeManager = useCallback(() => {
    setIsManagerOpen(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const removeTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    speedSmoothersRef.current.delete(id);
    retryDataRef.current.delete(id);
  }, []);

  const clearCompleted = useCallback(() => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
  }, []);

  /* ----------------------------------------------------
     FILE UPLOAD (Browser to VPS Storage)
     ---------------------------------------------------- */
  const startUpload = useCallback(
    (
      file: File,
      folderId: string | null,
      folderUid: string | null,
      folderName: string,
      duplicateMode?: 'replace' | 'keep_both' | null
    ): string => {
      const transferId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      const fileType = ext.length <= 4 ? `${ext} File` : 'Video File';

      const smoother = new SpeedSmoother(2500);
      speedSmoothersRef.current.set(transferId, smoother);

      const newItem: TransferItem = {
        id: transferId,
        type: 'upload',
        filename: file.name,
        fileType,
        status: 'uploading',
        stage: 'Uploading to VPS disk',
        loaded: 0,
        total: file.size,
        speed: 0,
        percent: 0,
        targetFolderId: folderId,
        targetFolderName: folderName,
        createdAt: Date.now(),
        canCancel: true,
        canRetry: false,
      };

      setTransfers((prev) => [newItem, ...prev]);
      // Automatically show manager floating in corner when transfer starts
      setIsManagerOpen(true);
      setIsMinimized(false);
      setActiveTab('active');

      const executeUpload = () => {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId) formData.append('folderId', folderId);
        if (folderUid) formData.append('folderUid', folderUid);
        if (duplicateMode) formData.append('duplicateMode', duplicateMode);

        const xhr = new XMLHttpRequest();
        xhrMapRef.current.set(transferId, xhr);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const currentSmoothedSpeed = smoother.update(e.loaded);
            const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));

            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== transferId) return t;
                return {
                  ...t,
                  status: 'uploading',
                  stage: pct >= 99 ? 'Processing on VPS...' : 'Uploading',
                  loaded: e.loaded,
                  total: e.total,
                  speed: currentSmoothedSpeed,
                  percent: pct,
                };
              })
            );
          }
        };

        xhr.onload = () => {
          xhrMapRef.current.delete(transferId);
          if (xhr.status >= 200 && xhr.status < 300) {
            let resFile: any = null;
            try {
              const res = JSON.parse(xhr.responseText);
              resFile = res.file;
            } catch {}

            const completedItem: TransferItem = {
              ...newItem,
              status: 'completed',
              stage: 'Upload complete',
              loaded: file.size,
              total: file.size,
              percent: 100,
              speed: 0,
              completedAt: Date.now(),
              canCancel: false,
              canRetry: false,
              file: resFile
                ? {
                    id: resFile.id,
                    folder_id: resFile.folder_id,
                    random_uid: resFile.random_uid,
                    stored_filename: resFile.stored_filename,
                    file_size: resFile.file_size,
                    raw_url: resFile.raw_url,
                    is_anime_episode: resFile.is_anime_episode,
                  }
                : undefined,
            };

            setTransfers((prev) =>
              prev.map((t) => (t.id === transferId ? completedItem : t))
            );

            notifyCompleted(completedItem);
          } else {
            let errorMsg = 'Upload failed';
            try {
              const res = JSON.parse(xhr.responseText);
              errorMsg = res.error || errorMsg;
            } catch {}

            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== transferId) return t;
                return {
                  ...t,
                  status: 'failed',
                  stage: 'Upload failed',
                  error: errorMsg,
                  speed: 0,
                  canCancel: false,
                  canRetry: true,
                  onRetry: () => retryTransfer(transferId),
                };
              })
            );
          }
        };

        xhr.onerror = () => {
          xhrMapRef.current.delete(transferId);
          setTransfers((prev) =>
            prev.map((t) => {
              if (t.id !== transferId) return t;
              return {
                ...t,
                status: 'failed',
                stage: 'Upload failed',
                error: 'Connection interrupted or network timeout',
                speed: 0,
                canCancel: false,
                canRetry: true,
                onRetry: () => retryTransfer(transferId),
              };
            })
          );
        };

        xhr.open('POST', '/api/files/upload', true);
        xhr.send(formData);
      };

      retryDataRef.current.set(transferId, executeUpload);
      executeUpload();

      return transferId;
    },
    [notifyCompleted]
  );

  /* ----------------------------------------------------
     URL IMPORT (VPS-side background streaming)
     ---------------------------------------------------- */
  const startUrlImport = useCallback(
    async (
      url: string,
      folderId: string | null,
      folderUid: string | null,
      folderName: string
    ): Promise<string> => {
      const res = await fetch('/api/files/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, folderId, folderUid }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate URL import');
      }

      const jobId = data.jobId;
      const initialFilename = url.split('/').pop()?.split('?')[0] || 'Imported Stream.mkv';

      const newItem: TransferItem = {
        id: jobId,
        type: 'url',
        filename: decodeURIComponent(initialFilename),
        fileType: 'Remote Stream',
        status: 'downloading',
        stage: 'Downloading from internet',
        loaded: 0,
        total: 0,
        speed: 0,
        percent: 0,
        targetFolderId: folderId,
        targetFolderName: folderName,
        createdAt: Date.now(),
        canCancel: true,
        canRetry: false,
      };

      setTransfers((prev) => [newItem, ...prev]);
      setIsManagerOpen(true);
      setIsMinimized(false);
      setActiveTab('active');

      const connectSSE = () => {
        const eventSource = new EventSource(`/api/transfers/${jobId}/events`);
        eventSourceMapRef.current.set(jobId, eventSource);

        eventSource.onmessage = (event) => {
          try {
            const update = JSON.parse(event.data);
            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== jobId) return t;

                const isDone = update.status === 'completed';
                const isFail = update.status === 'failed';
                const isCancelled = update.status === 'cancelled';

                if (isDone || isFail || isCancelled) {
                  eventSource.close();
                  eventSourceMapRef.current.delete(jobId);
                }

                const updatedItem: TransferItem = {
                  ...t,
                  filename: update.filename || t.filename,
                  status: update.status as TransferStatus,
                  stage: update.stage || update.status,
                  loaded: update.downloaded_bytes || t.loaded,
                  total: update.total_bytes || t.total,
                  speed: update.speed_bps || 0,
                  percent: update.percent || (update.total_bytes > 0 ? Math.round((update.downloaded_bytes / update.total_bytes) * 100) : 0),
                  error: update.error_message,
                  canCancel: !isDone && !isFail && !isCancelled,
                  canRetry: isFail,
                  file: update.file || t.file,
                  completedAt: isDone ? Date.now() : t.completedAt,
                };

                if (isDone) {
                  notifyCompleted(updatedItem);
                }

                return updatedItem;
              })
            );
          } catch (err) {
            console.error('SSE parse error', err);
          }
        };

        eventSource.onerror = () => {
          // If SSE fails or drops, fall back to reliable polling
          eventSource.close();
          eventSourceMapRef.current.delete(jobId);
          startJobPolling(jobId);
        };
      };

      const startJobPolling = (id: string) => {
        if (pollIntervalMapRef.current.has(id)) return;

        const interval = window.setInterval(async () => {
          try {
            const resp = await fetch(`/api/transfers/${id}`);
            if (!resp.ok) return;
            const resData = await resp.json();
            const tr = resData.transfer;

            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== id) return t;
                const isDone = tr.status === 'completed';
                const isFail = tr.status === 'failed';
                const isCancelled = tr.status === 'cancelled';

                if (isDone || isFail || isCancelled) {
                  window.clearInterval(interval);
                  pollIntervalMapRef.current.delete(id);
                }

                const updatedItem: TransferItem = {
                  ...t,
                  filename: tr.filename || t.filename,
                  status: tr.status as TransferStatus,
                  stage: tr.stage || tr.status,
                  loaded: tr.downloaded_bytes,
                  total: tr.total_bytes,
                  speed: tr.speed_bps,
                  percent: tr.percent,
                  error: tr.error_message,
                  canCancel: !isDone && !isFail && !isCancelled,
                  canRetry: isFail,
                  completedAt: isDone ? Date.now() : t.completedAt,
                };

                if (isDone) {
                  notifyCompleted(updatedItem);
                }

                return updatedItem;
              })
            );
          } catch {}
        }, 1000);

        pollIntervalMapRef.current.set(id, interval);
      };

      const retryHandler = () => {
        startUrlImport(url, folderId, folderUid, folderName);
      };
      retryDataRef.current.set(jobId, retryHandler);

      connectSSE();
      return jobId;
    },
    [notifyCompleted]
  );

  /* ----------------------------------------------------
     ZIP IMPORT (Multi-stage archive extraction on VPS)
     ---------------------------------------------------- */
  const startZipImport = useCallback(
    async (
      zipFile: File,
      folderId: string | null,
      folderUid: string | null,
      folderName: string
    ): Promise<string> => {
      const initialTransferId = `zip-init-${Date.now()}`;
      const smoother = new SpeedSmoother(2500);

      const newItem: TransferItem = {
        id: initialTransferId,
        type: 'zip',
        filename: zipFile.name,
        fileType: 'ZIP Archive',
        status: 'uploading',
        stage: 'Stage 1: Uploading ZIP archive',
        stageNumber: 1,
        totalStages: 6,
        loaded: 0,
        total: zipFile.size,
        speed: 0,
        percent: 0,
        extracted_files_count: 0,
        total_files_count: 0,
        detected_episodes_count: 0,
        targetFolderId: folderId,
        targetFolderName: folderName,
        createdAt: Date.now(),
        canCancel: true,
        canRetry: false,
      };

      setTransfers((prev) => [newItem, ...prev]);
      setIsManagerOpen(true);
      setIsMinimized(false);
      setActiveTab('active');

      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('zipFile', zipFile);
        if (folderId) formData.append('folderId', folderId);
        if (folderUid) formData.append('folderUid', folderUid);

        const xhr = new XMLHttpRequest();
        xhrMapRef.current.set(initialTransferId, xhr);

        // Stage 1: Uploading ZIP
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const currentSpeed = smoother.update(e.loaded);
            const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));

            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== initialTransferId) return t;
                return {
                  ...t,
                  loaded: e.loaded,
                  total: e.total,
                  speed: currentSpeed,
                  percent: pct,
                  stage: pct >= 99 ? 'Stage 2: Initializing extraction...' : 'Stage 1: Uploading ZIP archive',
                };
              })
            );
          }
        };

        xhr.onload = () => {
          xhrMapRef.current.delete(initialTransferId);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const jobId = res.jobId;

              // Replace temporary client ID with real server jobId
              setTransfers((prev) =>
                prev.map((t) => {
                  if (t.id !== initialTransferId) return t;
                  return {
                    ...t,
                    id: jobId,
                    status: 'extracting',
                    stage: 'Stage 2: Extracting files...',
                    stageNumber: 2,
                    totalStages: 6,
                    speed: 0,
                  };
                })
              );

              // Connect to real backend SSE for Stages 2 - 6
              const eventSource = new EventSource(`/api/transfers/${jobId}/events`);
              eventSourceMapRef.current.set(jobId, eventSource);

              eventSource.onmessage = (event) => {
                try {
                  const update = JSON.parse(event.data);
                  setTransfers((prev) =>
                    prev.map((t) => {
                      if (t.id !== jobId) return t;

                      const isDone = update.status === 'completed';
                      const isFail = update.status === 'failed';
                      const isCancelled = update.status === 'cancelled';

                      if (isDone || isFail || isCancelled) {
                        eventSource.close();
                        eventSourceMapRef.current.delete(jobId);
                      }

                      const updatedItem: TransferItem = {
                        ...t,
                        filename: update.filename || t.filename,
                        status: update.status as TransferStatus,
                        stage: update.stage || t.stage,
                        stageNumber: update.stageNumber || t.stageNumber,
                        totalStages: update.totalStages || 6,
                        percent: update.percent !== undefined ? update.percent : t.percent,
                        extracted_files_count: update.extracted_files_count ?? t.extracted_files_count,
                        total_files_count: update.total_files_count ?? t.total_files_count,
                        detected_episodes_count: update.detected_episodes_count ?? t.detected_episodes_count,
                        current_file: update.current_file || t.current_file,
                        error: update.error_message,
                        canCancel: !isDone && !isFail && !isCancelled,
                        canRetry: isFail,
                        completedAt: isDone ? Date.now() : t.completedAt,
                      };

                      if (isDone) {
                        notifyCompleted(updatedItem);
                      }

                      return updatedItem;
                    })
                  );
                } catch (err) {
                  console.error('ZIP SSE parse error', err);
                }
              };

              eventSource.onerror = () => {
                // Polling fallback
                eventSource.close();
                eventSourceMapRef.current.delete(jobId);

                const interval = window.setInterval(async () => {
                  try {
                    const resp = await fetch(`/api/transfers/${jobId}`);
                    if (!resp.ok) return;
                    const resData = await resp.json();
                    const tr = resData.transfer;

                    setTransfers((prev) =>
                      prev.map((t) => {
                        if (t.id !== jobId) return t;
                        const isDone = tr.status === 'completed';
                        const isFail = tr.status === 'failed';
                        const isCancelled = tr.status === 'cancelled';

                        if (isDone || isFail || isCancelled) {
                          window.clearInterval(interval);
                          pollIntervalMapRef.current.delete(jobId);
                        }

                        const updatedItem: TransferItem = {
                          ...t,
                          status: tr.status as TransferStatus,
                          stage: tr.stage,
                          percent: tr.percent,
                          extracted_files_count: tr.extracted_files_count,
                          total_files_count: tr.total_files_count,
                          detected_episodes_count: tr.detected_episodes_count,
                          current_file: tr.current_file,
                          error: tr.error_message,
                          canCancel: !isDone && !isFail && !isCancelled,
                          canRetry: isFail,
                          completedAt: isDone ? Date.now() : t.completedAt,
                        };

                        if (isDone) {
                          notifyCompleted(updatedItem);
                        }

                        return updatedItem;
                      })
                    );
                  } catch {}
                }, 1000);

                pollIntervalMapRef.current.set(jobId, interval);
              };

              resolve(jobId);
            } catch (err) {
              reject(err);
            }
          } else {
            let errorMsg = 'ZIP upload failed';
            try {
              const res = JSON.parse(xhr.responseText);
              errorMsg = res.error || errorMsg;
            } catch {}

            setTransfers((prev) =>
              prev.map((t) => {
                if (t.id !== initialTransferId) return t;
                return {
                  ...t,
                  status: 'failed',
                  stage: 'ZIP upload failed',
                  error: errorMsg,
                  canCancel: false,
                  canRetry: true,
                };
              })
            );
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          xhrMapRef.current.delete(initialTransferId);
          setTransfers((prev) =>
            prev.map((t) => {
              if (t.id !== initialTransferId) return t;
              return {
                ...t,
                status: 'failed',
                stage: 'ZIP upload failed',
                error: 'Network error occurred during ZIP upload',
                canCancel: false,
                canRetry: true,
              };
            })
          );
          reject(new Error('Network error'));
        };

        xhr.open('POST', '/api/files/import-zip', true);
        xhr.send(formData);
      });
    },
    [notifyCompleted]
  );

  /* ----------------------------------------------------
     CANCEL TRANSFER
     ---------------------------------------------------- */
  const cancelTransfer = useCallback(async (id: string) => {
    // Check if client-side XHR is uploading
    const activeXhr = xhrMapRef.current.get(id);
    if (activeXhr) {
      activeXhr.abort();
      xhrMapRef.current.delete(id);
    }

    // Check if backend job can be cancelled
    try {
      await fetch(`/api/transfers/${id}/cancel`, { method: 'POST' });
    } catch {}

    // Close event sources and polling
    const es = eventSourceMapRef.current.get(id);
    if (es) {
      es.close();
      eventSourceMapRef.current.delete(id);
    }

    const poll = pollIntervalMapRef.current.get(id);
    if (poll) {
      window.clearInterval(poll);
      pollIntervalMapRef.current.delete(id);
    }

    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status: 'cancelled',
          stage: 'Transfer cancelled',
          speed: 0,
          canCancel: false,
          canRetry: false,
        };
      })
    );
  }, []);

  /* ----------------------------------------------------
     RETRY TRANSFER
     ---------------------------------------------------- */
  const retryTransfer = useCallback((id: string) => {
    const retryFn = retryDataRef.current.get(id);
    if (retryFn) {
      // Remove old failed item
      removeTransfer(id);
      // Run retry
      retryFn();
    }
  }, [removeTransfer]);

  const activeTransfers = transfers.filter(
    (t) =>
      t.status === 'uploading' ||
      t.status === 'downloading' ||
      t.status === 'extracting' ||
      t.status === 'scanning' ||
      t.status === 'detecting' ||
      t.status === 'creating_records' ||
      t.status === 'processing' ||
      t.status === 'pending'
  );

  const completedTransfers = transfers.filter((t) => t.status === 'completed');
  const failedTransfers = transfers.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  return (
    <TransferContext.Provider
      value={{
        transfers,
        activeTransfers,
        completedTransfers,
        failedTransfers,
        isManagerOpen,
        setIsManagerOpen,
        isMinimized,
        setIsMinimized,
        activeTab,
        setActiveTab,
        openManager,
        closeManager,
        toggleMinimize,
        startUpload,
        startUrlImport,
        startZipImport,
        cancelTransfer,
        retryTransfer,
        removeTransfer,
        clearCompleted,
        subscribeCompleted,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
};
