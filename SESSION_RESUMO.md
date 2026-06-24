# Sessão DiaristCWB — 18/06/2026

## Escopo
Implementação dos **4 grandes módulos** no app DiaristCWB (Expo 54 + React Native 0.81 + Supabase):
conexão cliente↔diarista, formulário real de perfil, máscaras/validações, e upload de avatar.

---

## Estrutura atual (2.186 linhas de código)

```
App.tsx                             29     ← entry point (auth routing)
src/
  lib/supabase.ts                   21     ← cliente Supabase
  styles/theme.ts                   42     ← cores + 20 bairros de Curitiba
  types/index.ts                    38     ← UserType, DiaristaItem, Bairro, etc.
  utils/masks.ts                    24     ← maskPhone, maskPrice, isValidEmail/Phone
  utils/storage.ts                  30     ← uploadAvatar (bucket avatars)
  components/MapaDiaristas.tsx      85     ← mapa com marcadores por bairro
  components/UserAvatar.tsx         51     ← foto ou fallback com inicial
  screens/AuthScreen.tsx           382     ← login/signup com tipo + validações
  screens/HomeScreenCliente.tsx    606     ← busca, mapa, cards, solicitações
  screens/HomeScreenDiarista.tsx   878     ← tabs Perfil + Clientes Interessados
```

## O que foi feito

### Módulo 1 — Modularização do monolito
- App.tsx simplificado (só roteia entre AuthScreen, HomeScreenCliente, HomeScreenDiarista)
- Telas extraídas para `src/screens/`
- Mapa componentizado em `MapaDiaristas.tsx`
- Tema e tipos centralizados

### Módulo 2 — Formulário real de diarista
- 2 etapas (dados pessoais → endereço com select de bairro)
- Busca textual nos 20 bairros de Curitiba
- Aba "Clientes Interessados" com histórico de conexões

### Módulo 3 — Máscaras e validações
- `maskPhone` → formata `(41) 99999-9999`
- `maskPrice` → prefixo `R$` + 2 casas decimais
- `isValidEmail` → regex
- `isValidPhone` → 10 ou 11 dígitos
- Senha mínima 6 caracteres
- Validações em cascata antes do `supabase.auth.signUp()`

### Módulo 4 — Avatar + histórico
- `UserAvatar.tsx` — imagem real ou fallback com inicial + cor
- `uploadAvatar()` → `fetch(uri) → blob → Supabase Storage (bucket avatars) → update profiles.avatar_url`
- Botão de câmera no header (cliente e diarista)
- Modal "Minhas Solicitações" (cliente)
- Aba "Clientes Interessados" (diarista)
- Conexões buscadas em 2 queries: `connections` → `profiles` por IDs

### Correções de bugs
- `SafeAreaProvider` movido de App.tsx para dentro de cada screen
- Plugin `expo-image-picker` + permissões adicionados ao `app.json`
- Mapeamento `diarista_id` corrigido na HomeScreenDiarista
- `node_modules` deletado e reinstalado + `npx expo install --fix`
- `npx expo customize tsconfig.json` + `npm install @supabase/supabase-js`
- Removidos imports não utilizados (useCallback, Camera, DollarSign)

---

## Dependências

| Pacote | Versão |
|---|---|
| expo | ^54.0.35 |
| react | 19.1.0 |
| react-native | 0.81.5 |
| @supabase/supabase-js | ^2.108.2 |
| expo-image-picker | ~17.0.11 |
| expo-secure-store | ~15.0.8 |
| lucide-react-native | ^1.17.0 |
| react-native-maps | 1.20.1 |
| react-native-safe-area-context | ~5.6.0 |

## TypeScript
`npx tsc --noEmit` limpo (0 erros). tsconfig estende `expo/tsconfig.base` com `strict: true` e `jsx: "react-native"`.

## Supabase
- Tabelas: `profiles`, `addresses`, `connections`
- Bucket: `avatars` (armazenamento de fotos)
- Queries usam nomes em inglês (`'profiles'`, não `'perfis'`)

## Próximos comandos
```bash
npx expo start -c
```
