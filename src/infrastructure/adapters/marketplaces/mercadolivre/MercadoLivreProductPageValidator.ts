import { IProductPageValidator } from '../../../../domain/ports/IProductPageValidator.js';
import { PageInspection } from '../../../../domain/models/PageInspection.js';

export class MercadoLivreProductPageValidator implements IProductPageValidator {
  constructor(
    private readonly minScore: number = 70
  ) {}

  public async validate(inspection: PageInspection): Promise<{ isValid: boolean; confidence: number; evidences: string[] }> {
    let confidence = 0;
    const validatorEvidences: string[] = [];

    // 1. Código MLB / Link Canônico com MLB (+40)
    if (inspection.hasMLB) {
      confidence += 40;
      validatorEvidences.push('MLB code present (+40)');
    }

    // 2. Elemento de Título de Produto presente (+30)
    const hasTitle = inspection.evidences.some(e => e.includes('Product title element'));
    if (hasTitle) {
      confidence += 30;
      validatorEvidences.push('Product title element found (+30)');
    }

    // 3. Imagem Principal do Produto presente (+20)
    if (inspection.hasProductImage) {
      confidence += 20;
      validatorEvidences.push('Product image found (+20)');
    }

    // 4. Área de Compra / Botões principais presente (+10)
    if (inspection.hasBuyBox) {
      confidence += 10;
      validatorEvidences.push('Buy Actions block found (+10)');
    }

    const isValid = confidence >= this.minScore;

    return {
      isValid,
      confidence,
      evidences: validatorEvidences
    };
  }
}
