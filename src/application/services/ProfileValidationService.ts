import { IProfileValidator, ProfileValidationResult } from '../../domain/ports/IProfileValidator.js';

export class ProfileValidationService {
  constructor(private validator: IProfileValidator) {}

  public async validateProfile(marketplace: string, profileId: string): Promise<ProfileValidationResult> {
    return this.validator.validateStructure(marketplace, profileId);
  }
}
