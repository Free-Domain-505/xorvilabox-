import { type Response } from 'express';
import { EventEmitter } from 'events';
import { getDb } from './db.js';

export interface TransferProgressEvent {
  jobId: string;
  type: 'url' | 'zip' | 'upload';
  filename: string;
  status: 'pending' | 'uploading' | 'downloading' | 'extracting' | 'scanning' | 'detecting' | 'creating_records' | 'completed' | 'failed' | 'cancelled';
  stage?: string;
  stageNumber?: number;
  totalStages?: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
  percent: number;
  extracted_files_count: number;
  total_files_count: number;
  detected_episodes_count: number;
  current_file?: string;
  error_message?: string;
  target_folder_id?: string | null;
  file?: any;
  created_at?: string;
  updated_at?: string;
}

class TransferManager extends EventEmitter {
  private activeCancelHandlers = new Map<string, () => Promise<void> | void>();
  private jobCache = new Map<string, TransferProgressEvent>();
  private sseClients = new Set<{ res: Response; jobId?: string }>();

  constructor() {
    super();
    // Heartbeat to keep SSE connections open through Nginx and proxies
    setInterval(() => {
      for (const client of this.sseClients) {
        try {
          client.res.write(': keep-alive ping\n\n');
        } catch {
          this.sseClients.delete(client);
        }
      }
    }, 15000);
  }

  public registerCancelHandler(jobId: string, handler: () => Promise<void> | void) {
    this.activeCancelHandlers.set(jobId, handler);
  }

  public unregisterCancelHandler(jobId: string) {
    this.activeCancelHandlers.delete(jobId);
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const handler = this.activeCancelHandlers.get(jobId);
    if (handler) {
      try {
        await handler();
      } catch (err) {
        console.error(`[TransferManager] Error executing cancel handler for job ${jobId}:`, err);
      }
      this.activeCancelHandlers.delete(jobId);
    }

    const cached = this.jobCache.get(jobId);
    const updatedEvent: TransferProgressEvent = {
      jobId,
      type: cached?.type || 'url',
      filename: cached?.filename || 'transfer',
      status: 'cancelled',
      stage: 'Transfer cancelled',
      downloaded_bytes: cached?.downloaded_bytes || 0,
      total_bytes: cached?.total_bytes || 0,
      speed_bps: 0,
      percent: cached?.percent || 0,
      extracted_files_count: cached?.extracted_files_count || 0,
      total_files_count: cached?.total_files_count || 0,
      detected_episodes_count: cached?.detected_episodes_count || 0,
      error_message: 'Transfer cancelled by user',
      target_folder_id: cached?.target_folder_id || null,
      updated_at: new Date().toISOString(),
    };

    this.jobCache.set(jobId, updatedEvent);
    this.emitProgress(updatedEvent);

    // Update database
    try {
      const db = getDb();
      await db.execute({
        sql: `UPDATE import_jobs SET status = 'cancelled', speed_bps = 0, error_message = 'Transfer cancelled by user', updated_at = ? WHERE id = ?`,
        args: [new Date().toISOString(), jobId],
      });
    } catch (dbErr) {
      console.warn(`[TransferManager] Could not update cancelled status in DB for job ${jobId}:`, dbErr);
    }

    return true;
  }

  public emitProgress(event: TransferProgressEvent) {
    // Calculate percentage accurately if total_bytes > 0
    if (event.total_bytes > 0 && event.downloaded_bytes >= 0) {
      event.percent = Math.min(100, Math.round((event.downloaded_bytes / event.total_bytes) * 1000) / 10);
    }

    this.jobCache.set(event.jobId, event);

    // Dispatch SSE to clients
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      if (!client.jobId || client.jobId === event.jobId) {
        try {
          client.res.write(payload);
        } catch {
          this.sseClients.delete(client);
        }
      }
    }

    this.emit('progress', event);
  }

  public getJob(jobId: string): TransferProgressEvent | undefined {
    return this.jobCache.get(jobId);
  }

  public addSSEClient(res: Response, jobId?: string) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Crucial for Nginx streaming without buffer
    res.flushHeaders?.();

    const client = { res, jobId };
    this.sseClients.add(client);

    // Send immediate initial state if jobId matches
    if (jobId && this.jobCache.has(jobId)) {
      const current = this.jobCache.get(jobId);
      res.write(`data: ${JSON.stringify(current)}\n\n`);
    }

    res.on('close', () => {
      this.sseClients.delete(client);
    });
  }
}

export const transferManager = new TransferManager();
