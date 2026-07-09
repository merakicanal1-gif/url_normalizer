import { z } from 'zod';

export const normalizeSchema = z.object({
  url: z.string({
    required_error: 'A URL é obrigatória.',
    invalid_type_error: 'A URL deve ser uma string.'
  })
  .url({ message: 'A URL fornecida deve ser um endereço absoluto válido (HTTP/HTTPS).' })
  .refine(val => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'A URL deve iniciar com http:// ou https://'
  })
});

export type NormalizeInput = z.infer<typeof normalizeSchema>;
