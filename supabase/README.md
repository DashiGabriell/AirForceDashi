# Supabase (AFD)

Fonte de verdade do banco: **`migrations/`**.

A API (`apps/api`) persiste em `public.afd_*` com **service_role** (RLS ligado, sem policy para `anon` / `authenticated`).

## Aplicar schema

### Preferido — CLI

```bash
npx supabase link --project-ref pkcupqxmeftiakpzdxls
npx supabase db push
```

### Sem CLI — Management API (precisa `SUPABASE_TOKEN` no `.env`)

```bash
node tools/apply-afd-migration.mjs
```

Smoke:

```bash
node tools/smoke-supabase-persist.mjs
```

## Novas mudanças

1. `npx supabase migration new nome_da_mudanca`
2. Editar o `.sql` gerado
3. `npx supabase db push` (ou o script apply)
4. Commitar o arquivo em `migrations/`

## Legado

Scripts antigos que criavam schema `afd.*` ou SQL inline (`expose-afd-schema`, `apply-afd-public-tables`) foram substituídos por esta pasta. Não use como fonte de verdade.
