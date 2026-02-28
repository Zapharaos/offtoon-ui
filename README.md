# Offtoon UI

**Offtoon** is a modern web application for searching, browsing, and downloading webtoons and manga chapters from various online sources. It provides a streamlined interface to search for toons, explore chapter lists, and download content in multiple formats (PDF, CBZ, or raw images) with real-time progress tracking via WebSocket.

## 🎯 What is Offtoon?

Offtoon helps users:
- **Search** for webtoons and manga across multiple sources (e.g., Asura)
- **Browse** detailed toon pages including cover art, author, artist, status, and chapter lists
- **Download** selected chapters in PDF, CBZ, or image formats
- **Track** download progress in real time with per-chapter and per-image reporting
- **Sort & filter** search results by name, source, status, or chapter count

## 🛠️ Technologies

Built with modern web technologies:

- **Angular 19** – Modern TypeScript-based web framework
- **PrimeNG** – Rich UI component library
- **Tailwind CSS** – Utility-first CSS framework
- **ngx-translate** – Internationalization support
- **RxJS** – Reactive programming & WebSocket streams

## 🚀 Getting Started

### Prerequisites
- **Node.js**: 18.x or higher
- **pnpm**: 8.x or higher (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd offtoon-ui
```

2. Install dependencies:
```bash
pnpm install
```

## 💻 Development

### Start Development Server

```bash
pnpm start
# or
ng serve
```

The application will be available at `http://localhost:4200/`. The dev server uses hot reload — any changes to source files will automatically refresh the browser.

### Development Environment

The development environment (`src/environments/environment.development.ts`) is configured with:
- **API URL**: `http://localhost:3000`
- **WebSocket URL**: `ws://localhost:3000`
- **Debug Features**: Enabled (e.g., table index visibility)

> **Note**: Ensure your backend API is running on port 3000 before starting the development server.

### Code Generation

Generate new components, services, or other Angular artifacts:

```bash
# Generate a new component
ng generate component modules/feature-name/components/component-name

# Generate a new service
ng generate service modules/feature-name/services/service-name

# View all available schematics
ng generate --help
```

### Testing

Run unit tests with Karma:

```bash
pnpm test
# or
ng test
```

Tests are written using Jasmine and run in a Chrome browser instance.

## 🏭 Production

### Building for Production

```bash
pnpm build
# or
ng build
```

Production build artifacts will be generated in the `dist/offtoon-ui/` directory. The production build:
- Uses `src/environments/environment.ts` configuration
- Optimizes code for performance (minification, tree-shaking)
- Enables Ahead-of-Time (AOT) compilation
- Applies production-specific settings

> **⚠️ Important**: Before building for production, update the API URLs in `src/environments/environment.ts` to point to your production backend.

### Production Environment Configuration

Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  production: true,
  tableSetHideIndex: true,
  apiUrl: 'https://your-production-api.com',
  wsUrl: 'wss://your-production-api.com'
};
```

### Deployment

After building, deploy the contents of the `dist/offtoon-ui/` directory to your web server or hosting platform (e.g., Nginx, Apache, AWS S3, Netlify, Vercel).

For single-page application routing, ensure your server redirects all requests to `index.html`.

## 🌍 Internationalization

Offtoon supports multiple languages. Translation files are located in `src/assets/i18n/`, for example:
- `en-US.json` – English (US)

To add a new language:
1. Create a new JSON file in `src/assets/i18n/` (e.g., `fr-FR.json`)
2. Copy the structure from an existing translation file
3. Translate all strings
4. Update the locale configuration in `src/app/core/config/locale.config.ts`

## 🎨 Theming

The application uses PrimeNG with custom Tailwind CSS theming. Theme configurations are located in:
- `src/assets/presets/` – PrimeNG theme presets
- `tailwind.config.js` – Tailwind configuration

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `angular.json` | Angular CLI and build configuration |
| `tsconfig.json` | TypeScript compiler options |
| `tailwind.config.js` | Tailwind CSS configuration |
| `package.json` | Dependencies and scripts |

## 📜 Scripts

```bash
pnpm start          # Start development server
pnpm build          # Build for production
pnpm test           # Run unit tests
pnpm watch          # Build in watch mode
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow the Angular style guide
- Use TypeScript strict mode
- Write unit tests for new features
- Ensure all tests pass before submitting a PR

## 📄 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Matthieu FREITAG

## 📚 Additional Resources

- [Angular Documentation](https://angular.dev)
- [Angular CLI Reference](https://angular.dev/tools/cli)
- [PrimeNG Components](https://primeng.org)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
