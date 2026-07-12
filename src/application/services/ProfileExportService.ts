import * as zlib from 'node:zlib';
import { IProfileExporterService, IProfileExporter } from '../../domain/ports/IProfileExporter.js';

export class ProfileExportService implements IProfileExporterService {
  constructor(private exporter: IProfileExporter) {}

  public async exportProfile(marketplace: string, profileId: string): Promise<Buffer> {
    const pkg = await this.exporter.exportPackage(marketplace, profileId);
    
    // Serializar ProfilePackage para JSON string
    const jsonString = JSON.stringify(pkg);
    
    // Comprimir via gzip nativo
    return new Promise<Buffer>((resolve, reject) => {
      zlib.gzip(jsonString, (err, buffer) => {
        if (err) {
          reject(new Error(`Failed to compress profile package: ${err.message}`));
        } else {
          resolve(buffer);
        }
      });
    });
  }
}
