import { ProfilePackage } from '../models/ProfilePackage.js';

export interface IProfileImporter {
  importPackage(pkg: ProfilePackage): Promise<void>;
}
export interface IProfileImporterService {
  importProfile(profileBuffer: Buffer): Promise<{ marketplace: string; profileId: string; version: number }>;
}
