import type { ISODate, Loan, Settings } from '../model/types';
import type { PlannedNotification } from '../services/notifications';

/** Interfaces implemented by platform adapters (README §4.7). */

export interface LoanRepository {
  list(): Promise<Loan[]>;
  get(id: string): Promise<Loan | undefined>;
  save(loan: Loan): Promise<void>;
  delete(id: string): Promise<void>;
  /** Loans with updatedAt > since (sync extension point, §4.9). */
  listChanges(since: string): Promise<Loan[]>;
}

export interface SettingsRepository {
  get(): Promise<Settings | undefined>;
  save(settings: Settings): Promise<void>;
}

export interface MetaStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export interface DataStore {
  loans: LoanRepository;
  settings: SettingsRepository;
  meta: MetaStore;
  transaction<T>(fn: (store: DataStore) => Promise<T>): Promise<T>;
}

export interface Clock {
  /** The user's local calendar date. */
  today(): ISODate;
  /** ISO 8601 UTC timestamp. */
  now(): string;
}

export interface IdGenerator {
  uuid(): string;
}

export interface NotificationScheduler {
  replaceAll(plan: PlannedNotification[]): Promise<void>;
}

export interface FileGateway {
  share(file: { name: string; mimeType: string; content: string; bom: boolean }): Promise<void>;
  pick(): Promise<{ name: string; content: string } | undefined>;
}

export interface CorePorts {
  store: DataStore;
  clock: Clock;
  ids: IdGenerator;
  notifications: NotificationScheduler;
  files: FileGateway;
}
