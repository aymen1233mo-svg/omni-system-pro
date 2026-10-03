/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'ar' | 'en';

export type SplashTheme = 'midnight' | 'emerald' | 'charcoal' | 'purple' | 'amber';
export type LoaderType = 'bar' | 'spinner' | 'pulse';
export type ClientType = 'local' | 'dev-server';
export type DatabaseType = 'sqlite' | 'lowdb' | 'postgresql' | 'none';

export interface AppConfig {
  appName: string;
  clientPort: number;
  apiPort: number;
  clientType: ClientType;
  splashTitle: string;
  splashSubtitle: string;
  splashTheme: SplashTheme;
  loaderType: LoaderType;
  checkInterval: number;
  maxTimeout: number;
  backendCommand: string;
  databaseType: DatabaseType;
}

export interface TerminalLog {
  id: string;
  time: string;
  source: 'electron' | 'backend' | 'system';
  type: 'info' | 'success' | 'warn' | 'error';
  messageAr: string;
  messageEn: string;
}
