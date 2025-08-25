# 🤝 Contributing to Sales Tool Detector

> **Welcome! We're excited that you want to contribute to Sales Tool Detector. This guide will help you get started.**

## 🎯 How You Can Help

We welcome all kinds of contributions:
- 🐛 **Bug reports** - Help us identify and fix issues
- 💡 **Feature requests** - Suggest new capabilities 
- 🔧 **Code contributions** - Implement features or fixes
- 📚 **Documentation** - Improve guides and examples
- 🧪 **Testing** - Help validate functionality
- 💬 **Community support** - Help other users in discussions

## 🚀 Quick Start

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/job-scraper.git
cd job-scraper

# Add the upstream repository
git remote add upstream https://github.com/eimribar/job-scraper.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Set up your development environment variables
# See README.md for required values

# Start development server
npm run dev
```

### 3. Make Your Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code, code, code ...

# Test your changes
npm run build
npm run lint

# Commit your changes
git add .
git commit -m "feat: add amazing new feature"
```

### 4. Submit a Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Open a pull request on GitHub
```

## 📋 Development Guidelines

### Code Style

We use a consistent code style across the project:

```bash
# Lint your code
npm run lint

# Format code (if you have Prettier configured)
npm run format
```

**Key conventions:**
- Use TypeScript for all new code
- Follow existing naming patterns
- Add JSDoc comments for complex functions
- Use meaningful variable and function names
- Keep functions small and focused

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
feat: add slack notification integration
fix: resolve duplicate job processing bug
docs: update installation guide
refactor: optimize database query performance
test: add unit tests for scraper service
```

### Branch Naming

Use descriptive branch names:
- `feature/slack-notifications`
- `bugfix/duplicate-jobs`
- `docs/update-readme`
- `refactor/database-queries`

## 🏗️ Project Structure

Understanding the codebase structure:

```
job-scraper/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── scrape/           # Scraping endpoints
│   │   ├── analyze/          # Analysis endpoints  
│   │   └── companies/        # Company endpoints
│   ├── page.tsx              # Main dashboard page
│   └── layout.tsx            # Root layout
├── components/               # React components
│   ├── ui/                   # shadcn/ui components
│   ├── dashboard/            # Dashboard components
│   └── companies/            # Company-related components
├── lib/                      # Utility libraries
│   ├── services/             # Business logic services
│   │   ├── scraperService.ts # Job scraping logic
│   │   ├── analysisService.ts# AI analysis logic
│   │   └── dataService.ts    # Database operations
│   ├── supabase.ts           # Database client
│   └── utils.ts              # Helper utilities
├── public/                   # Static assets
├── supabase-schema.sql       # Database schema
├── tailwind.config.js        # Tailwind configuration
└── next.config.ts            # Next.js configuration
```

## 🔍 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new features and bug fixes
- Use descriptive test names
- Test both success and error scenarios
- Mock external dependencies (Apify, OpenAI, Supabase)

**Example test structure:**
```typescript
describe('ScraperService', () => {
  describe('scrapeIndeedJobs', () => {
    it('should return scraped jobs successfully', async () => {
      // Test implementation
    });

    it('should handle API errors gracefully', async () => {
      // Error handling test
    });
  });
});
```

## 📝 Documentation

### Updating Documentation

- Update README.md for new features
- Add JSDoc comments for new functions
- Update API documentation for endpoint changes
- Include examples in your documentation

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Use proper markdown formatting
- Add screenshots for UI changes

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Reproduce the bug** with minimal steps
3. **Test with latest version** to ensure it's current
4. **Check your environment** (Node.js version, OS, etc.)

### Bug Report Template

```markdown
## Bug Description
A clear and concise description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'  
3. Scroll down to '...'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior  
What actually happened.

## Environment
- OS: [e.g. macOS 14.0]
- Browser: [e.g. Chrome 91]
- Node.js: [e.g. 18.17.0]
- App version: [e.g. 1.0.0]

## Additional Context
Screenshots, error messages, logs, etc.
```

## 💡 Feature Requests

### Suggesting Features

1. **Check existing requests** first
2. **Describe the problem** you're trying to solve
3. **Explain your proposed solution**
4. **Consider alternative solutions**
5. **Think about implementation complexity**

### Feature Request Template

```markdown
## Problem Statement
What problem does this solve?

## Proposed Solution
Detailed description of your proposed feature.

## Alternatives Considered
Other approaches you've thought about.

## Additional Context
Mockups, examples, related issues, etc.
```

## 🎭 Types of Contributions

### 🔧 Code Contributions

**Good first issues:**
- Documentation improvements
- UI/UX enhancements
- Test coverage improvements
- Performance optimizations
- Bug fixes

**Advanced contributions:**
- New integrations (Slack, CRMs)
- Advanced filtering features
- Analytics and reporting
- Security improvements
- Scalability enhancements

### 📚 Non-Code Contributions

**Documentation:**
- Improve setup guides
- Add troubleshooting tips
- Create video tutorials
- Translate documentation

**Community:**
- Answer questions in discussions
- Help with issue triage
- Share on social media
- Write blog posts about usage

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] Branch is up-to-date with main

### PR Description Template

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Other (please describe)

## Testing
- [ ] Existing tests pass
- [ ] New tests added
- [ ] Manual testing completed

## Screenshots
If applicable, add screenshots of UI changes.

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** run first (lint, build, tests)
2. **Maintainer review** for code quality and design
3. **Community feedback** from other contributors
4. **Iterations** based on feedback
5. **Merge** once approved

## 🚀 Development Setup Details

### Required Tools

- **Node.js 18+** - JavaScript runtime
- **npm 9+** - Package manager  
- **Git** - Version control
- **VS Code** (recommended) - Code editor

### Recommended VS Code Extensions

- **TypeScript** - Enhanced TS support
- **Tailwind CSS IntelliSense** - CSS class suggestions
- **ES7+ React/Redux/React-Native snippets** - Code snippets
- **Prettier** - Code formatting
- **ESLint** - Code linting

### Environment Variables

Development environment variables needed:

```bash
# Required for full functionality
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
APIFY_TOKEN=your_apify_token

# Optional for development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🎯 Areas We Need Help

### High Priority

- **Slack Integration** - Real-time notifications
- **Advanced Filtering** - More sophisticated search options
- **Error Recovery** - Better handling of API failures
- **Performance** - Optimize database queries and UI rendering

### Medium Priority

- **Testing** - Increase test coverage
- **Documentation** - More examples and tutorials
- **UI/UX** - Design improvements and accessibility
- **Analytics** - Better insights and reporting

### Future Opportunities

- **CRM Integrations** - Salesforce, HubSpot connections
- **Territory Mapping** - Geographic filtering and insights
- **Multi-tenant** - Support for multiple organizations
- **Mobile App** - React Native implementation

## ❓ Questions?

- 💬 **GitHub Discussions** - General questions and ideas
- 🐛 **GitHub Issues** - Bug reports and feature requests
- 📧 **Email** - [your-email@domain.com](mailto:your-email@domain.com) for sensitive matters

---

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behaviors:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could be considered inappropriate

### Enforcement

Report violations to [your-email@domain.com](mailto:your-email@domain.com). All reports will be reviewed and investigated.

---

<div align="center">

**Thank you for contributing to Sales Tool Detector!** 🎉

[🏠 Back to README](README.md) • [📝 View Issues](https://github.com/eimribar/job-scraper/issues) • [💬 Join Discussions](https://github.com/eimribar/job-scraper/discussions)

</div>