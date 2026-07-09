export interface NormalizedProduct {
  success: boolean;
  marketplace: string;
  url_final: string;
  id_produto: string;
  titulo: string;
  imagem: string;
}

export interface ExtractedProductData {
  id_produto: string;
  titulo: string;
  imagem: string;
}
