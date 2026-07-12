import { ProfilePackage } from '../models/ProfilePackage.js';

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface IProfileValidator {
  validateStructure(marketplace: string, profileId: string): Promise<ProfileValidationResult>;
  validatePackage(pkg: ProfilePackage): Promise<ProfileValidationResult>;
}
