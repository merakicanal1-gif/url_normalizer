import { PageInspection } from '../models/PageInspection.js';

export interface IProductPageValidator {
  validate(inspection: PageInspection): Promise<{ isValid: boolean; confidence: number; evidences: string[] }>;
}
