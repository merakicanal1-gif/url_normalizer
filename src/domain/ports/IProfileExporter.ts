import { ProfilePackage } from '../models/ProfilePackage.js';

export interface IProfileExporter {
  exportPackage(marketplace: string, profileId: string): Promise<ProfilePackage>;
}
export interface IProfileExporterService {
  exportProfile(marketplace: string, profileId: string): Promise<Buffer>;
}
