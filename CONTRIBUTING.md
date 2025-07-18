# Contributing to OutlineText VS Code Extension

Thank you for your interest in contributing to the OutlineText VS Code extension! This guide will help you set up your development environment and understand the development workflow.

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Visual Studio Code
- Git

## Initial Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ContentsViewer/vscode-outlinetext.git
   cd vscode-outlinetext
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Compile the extension**
   ```bash
   npm run compile
   ```

## Running the Extension Locally

### Method 1: Using VS Code (Recommended)

1. Open the project in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. The extension will automatically compile in watch mode
4. Open a `.content` or `.otl` file to test the extension

### Method 2: Manual Compilation and Watch

1. **Run in watch mode for development**
   ```bash
   npm run watch
   ```
   This will watch both the client and server TypeScript files for changes.

2. **In VS Code, press `F5`** to launch the Extension Development Host

### Debugging

- Set breakpoints in the TypeScript source files
- Use the VS Code debugger when running with `F5`
- Check the "Output" panel and select "OutlineText" from the dropdown for extension logs
- Check the "Output" panel and select "OutlineText Language Server" for server logs

## Testing

Run the test suite:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## Packaging the Extension

Before packaging, ensure all tests pass and the code is properly compiled.

1. **Install vsce (Visual Studio Code Extension manager)**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Package the extension**
   ```bash
   npm run package
   ```
   This creates a `.vsix` file in the project root.

3. **Test the packaged extension**
   - In VS Code, go to Extensions view (Ctrl+Shift+X)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the generated `.vsix` file
   - Restart VS Code and test the extension

## Publishing the Extension

### Prerequisites for Publishing

1. **Create a publisher account**
   - Go to https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft account
   - Create a publisher if you don't have one

2. **Generate a Personal Access Token (PAT)**
   - Go to https://dev.azure.com/
   - Click on your profile � Security � Personal access tokens
   - Create a new token with "Marketplace (Publish)" scope

### Publishing Process

1. **Login to vsce**
   ```bash
   vsce login <publisher-name>
   ```
   Enter your PAT when prompted.

2. **Publish the extension**
   ```bash
   npm run publish
   ```
   
   Or publish with a specific version bump:
   ```bash
   vsce publish minor  # or major, patch
   ```

3. **Verify publication**
   - Check https://marketplace.visualstudio.com/
   - Search for your extension
   - It may take a few minutes to appear

### Alternative: Manual Publishing

If you prefer to publish the `.vsix` file manually:

1. Package the extension first:
   ```bash
   npm run package
   ```

2. Go to https://marketplace.visualstudio.com/manage
3. Select your publisher
4. Click "New Extension" � "Visual Studio Code"
5. Upload the `.vsix` file

## Project Structure

```
vscode-outlinetext/
   src/                    # Extension client code
      extension.ts        # Main extension entry point
   server/                 # Language Server Protocol implementation
      src/
         server.ts       # LSP server entry point
         parser.ts       # OutlineText parser wrapper
         cache.ts        # Caching implementation
         shared/         # Shared types
      tsconfig.json       # Server TypeScript config
   syntaxes/              # TextMate grammar files
   wasm/                  # WASM parser files
   package.json           # Extension manifest
   tsconfig.json          # Client TypeScript config
```

## Development Tips

1. **Enable auto-refresh for preview**: The extension setting `outlinetext.preview.autoRefresh` controls automatic preview updates.

2. **Parser caching**: The parser implements caching by default. Disable with the `outlinetext.parser.enableCache` setting for debugging.

3. **Language Server logs**: Enable detailed logging by setting the `OUTLINETEXT_DEBUG` environment variable.

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- Use TypeScript strict mode
- Follow the existing code formatting
- Run `npm run lint` before committing
- Add appropriate type annotations

## Questions?

If you have questions about development, please open an issue on GitHub.