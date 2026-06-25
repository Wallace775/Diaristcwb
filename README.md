# DiaristCWB

O **DiaristCWB** é um aplicativo mobile desenvolvido em React Native com Expo, projetado especificamente para conectar moradores de Curitiba a diaristas de forma rápida, simples e direta. Os clientes encontram profissionais por bairro, preço e avaliação, e entram em contato via WhatsApp para negociar e agendar a faxina, enquanto as diaristas ganham mais visibilidade e autonomia para conquistar novos clientes.

## Funcionalidades Principais

- **Painel do Cliente:** Busca de profissionais filtrada por bairros de Curitiba, com visualização integrada em mapa dinâmico.
- **Painel da Diarista:** Cadastro de perfil com informações de atendimento, valor da faxina e avaliações.
- **Integração com WhatsApp:** Redirecionamento direto para o chat do WhatsApp para agendamentos rápidos.
- **Geolocalização Nativa:** Tratamento robusto de permissões de localização no Android para carregamento fluido do mapa.

## Tecnologias Utilizadas

- React Native
- Expo (EAS Build para geração de APKs de Preview/Produção)
- TypeScript / JavaScript
- Supabase (Banco de Dados e Backend)

## Como Executar o Projeto Localmente

### Pré-requisitos
Certifique-se de ter o Node.js e o Git instalados em sua máquina de desenvolvimento.

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/Wallace775/Diaristcwb.git
   cd Diaristcwb
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar variáveis de ambiente:**
   Copie o arquivo `.env.example` para `.env` e preencha as chaves necessárias (Supabase URL, Google Maps API Key, etc.).

4. **Iniciar o projeto:**
   ```bash
   npx expo start
   ```

5. **Gerar APK com EAS Build:**
   ```bash
   eas build --platform android --profile preview
   ```

## Estrutura do Projeto

```
Diaristcwb/
├── assets/               # Imagens, ícones e splash screen
├── src/
│   ├── components/       # Componentes reutilizáveis (MapaDiaristas, UserAvatar, etc.)
│   ├── config/           # Configurações externas (Google Maps)
│   ├── contexts/         # Contextos React (ThemeContext)
│   ├── lib/              # Cliente Supabase
│   ├── screens/          # Telas do app (Auth, HomeScreenCliente, HomeScreenDiarista)
│   ├── styles/           # Tema e estilos globais
│   ├── types/            # Tipos TypeScript
│   └── utils/            # Utilitários (masks, storage)
├── App.tsx               # Entry point com roteamento condicional
├── app.json              # Configuração Expo
└── eas.json              # Configuração EAS Build
```

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
