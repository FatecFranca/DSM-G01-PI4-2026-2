import { z } from 'zod';

/* regras de senha (as mesmas do cadastro no web/mobile) */
const senhaForte = z
  .string()
  .min(8, 'A senha precisa ter 8+ caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.') // limite do bcrypt
  .regex(/[a-zA-ZÀ-ÿ]/, 'A senha precisa ter uma letra.')
  .regex(/\d/, 'A senha precisa ter um número.');

const registroBase = z.object({
  nome: z
    .string()
    .trim()
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Informe nome e sobrenome.')
    .refine((v) => v.length <= 100, 'Nome muito longo.'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[\w.]{3,20}$/, 'Use 3 a 20 caracteres: letras, números, _ ou ponto.'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: senhaForte,
});

export const registroSchema = registroBase
  .extend({
    // exatamente UM dos dois: cria empresa nova OU entra por convite
    organizacao: z.string().trim().min(2, 'Informe o nome da empresa.').max(80, 'Nome da empresa muito longo.').optional(),
    codigoConvite: z.string().trim().min(6, 'Informe o código de convite.').max(20, 'Código muito longo.').optional(),
  })
  .refine((d) => !!d.organizacao !== !!d.codigoConvite, {
    message: 'Informe o nome da empresa OU um código de convite.',
    path: ['organizacao'],
  });

export const conviteCriarSchema = z.object({
  papel: z.enum(['operador', 'dono']).default('operador'),
  dias: z.number().int().min(1).max(30).default(7),
});

export const membroCriarSchema = z.object({
  nome: registroBase.shape.nome,
  usuario: registroBase.shape.usuario,
  email: registroBase.shape.email,
  senha: registroBase.shape.senha,
  papel: z.enum(['operador', 'dono']).default('operador'),
});

export const papelSchema = z.object({ papel: z.enum(['operador', 'dono']) });

export const dispositivoCriarSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome para a máquina.').max(40, 'Nome muito longo.'),
});

export const simuladorSchema = z.object({
  ativo: z.boolean(),
  deviceId: z.string().min(1).max(40).optional(),
}).refine((s) => !s.ativo || !!s.deviceId, { message: 'Escolha uma máquina.', path: ['deviceId'] });

export const loginSchema = z.object({
  identificador: z.string().trim().toLowerCase().min(1, 'Informe usuário ou e-mail.'),
  senha: z.string().min(1, 'Informe a senha.').max(72),
});

export const disponibilidadeSchema = z.object({
  usuario: z.string().trim().toLowerCase().optional(),
  email: z.string().trim().toLowerCase().optional(),
});

/* evento de peça (payload MQTT e POST /eventos) */
export const eventoSchema = z
  .object({
    comp: z.coerce.number().int().positive(),
    bitola: z.string().regex(/^M\d{1,2}$/).nullable().optional(),
    peso: z.coerce.number().nonnegative(),
    valido: z.boolean(),
  })
  .refine((e) => !e.valido || !!e.bitola, {
    message: 'Peça válida precisa informar a bitola.',
    path: ['bitola'],
  });

export const statusSchema = z.object({
  online: z.boolean().optional(),
  ligado: z.boolean().optional(),
});

export const comandoSchema = z
  .object({
    deviceId: z.string().min(1).max(40).optional(),
    ligado: z.boolean().optional(),
    tara: z.literal(true).optional(), // zera a balança
  })
  .refine((c) => c.ligado !== undefined || c.tara, { message: 'Envie "ligado" ou "tara".', path: ['ligado'] });

export const telemetriaSchema = z.object({
  peso: z.number().min(-1000).max(100000),
  estavel: z.boolean().optional(),
  rssi: z.number().optional(),
});

export const pedidoCriarSchema = z.object({
  bitola: z.string().regex(/^M\d{1,2}$/, 'Bitola inválida.'),
  comprimentoMm: z.number().int().positive('Comprimento inválido.'),
  quantidade: z.number().int('Use um número inteiro.').min(1, 'Peça ao menos 1.').max(100000, 'Quantidade muito alta.'),
  deviceId: z.string().min(1).max(40).optional(),
});

export const pedidosQuerySchema = z.object({
  status: z.enum(['aberto', 'retirado', 'cancelado']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const eventosQuerySchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  bitola: z.string().regex(/^M\d{1,2}$/).optional(),
  valido: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

export const resumoQuerySchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export const configUpdateSchema = z
  .object({
    limiteBaixo: z.number().int().min(0).max(1_000_000).optional(),
    kDesvios: z.number().min(0.5).max(5).optional(),
    tabelaPeso: z
      .array(
        z.object({
          comprimentoMm: z.number().int().positive(),
          bitola: z.string().regex(/^M\d{1,2}$/),
          media: z.number().positive(),
          desvio: z.number().positive(),
        })
      )
      .optional(),
  })
  .refine((c) => Object.keys(c).length > 0, 'Envie ao menos um campo.');
