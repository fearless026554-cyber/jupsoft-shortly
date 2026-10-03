// ============================================================================
// Canonical BullMQ Queue Names & Job Names
// ============================================================================

export const QueueNames = {
  CLICKS: 'click-ingestion-queue',
  BULK_LINKS: 'bulk-link-creation-queue',
  URL_SCREENING: 'url-screening-queue',
} as const;

export const JobNames = {
  INGEST_CLICK: 'ingest-click',
  PROCESS_BULK_LINKS: 'process-bulk-links',
  SCREEN_URL: 'screen-url',
} as const;

export const QUEUE_NAMES = QueueNames;
export const JOB_NAMES = JobNames;

export const QueueRetryOptions = {
  CLICKS: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
  BULK: {
    attempts: 2,
    backoff: { type: 'fixed' as const, delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
  SCREENING: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
} as const;
