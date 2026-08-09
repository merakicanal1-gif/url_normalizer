export interface NormalizedProduct {
  success: boolean;
  is_produto?: boolean;
  tipo_pagina?: string;
  marketplace: string;
  id_produto: string | null;
  nome_produto: string | null;
  url_imagem: string | null;
  url_produto: string;
  link_afiliado?: string | null;
  preco_anterior?: number | null;
  preco_atual?: number | null;
  mensagem?: string | null;
}

export interface ExtractedProductData {
  id_produto: string | null;
  nome_produto: string | null;
  url_imagem: string | null;
  url_produto: string;
  preco_anterior?: number | null;
  preco_atual?: number | null;
}


