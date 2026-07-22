# Software Design Specification (SDS)

## Note Taking Application

---

## 1. Document Information

| Field               | Value                                      |
| ------------------- | ------------------------------------------ |
| Document Title      | Software Design Specification              |
| Project Name        | Note Taking Application                    |
| Version             | 1.0.0                                      |
| Status              | Draft                                   |
| Created Date        | 2026-07-21                                 |
| Last Updated        | 2026-07-21                                 |
| Related Documents   | FRS.md, UX.md                              |

---

## 2. Introduction

This Software Design Specification (SDS) documents the technical architecture, data design, API specifications, component hierarchy, and security mechanics for the Note Taking Application. It acts as the definitive engineering blueprint for implementing the functional requirements specified in `FRS.md` and the user interfaces specified in `UX.md`.

All technical patterns, library choices, and architectural boundaries in this document adhere strictly to the constraints outlined in the project assignment.

---

## 3. Technology Stack

| Layer                | Technology                                      | Pinned Version | Purpose / Justification                                       |
| -------------------- | ----------------------------------------------- | -------------- | ------------------------------------------------------------- |
| **Monorepo Manager** | `pnpm` Workspaces                               | 9.15.4         | Workspace isolation, fast disk space efficient installs       |
| **Language**         | TypeScript                                      | 5.9.2          | End-to-end type safety across shared schemas, FE, and BE      |
| **Frontend Framework**| React                                           | 19.1.0         | UI rendering, concurrent features, modern component ecosystem |
| **Build Tool (FE)**  | Vite                                            | 6.0.11         | Fast HMR, optimized ESM bundling                              |
| **UI Primitive**     | Tailwind CSS + `shadcn/ui` (Radix)              | 3.4.19         | Accessible, customizable component design system             |
| **Rich Text Editor** | TipTap (ProseMirror wrapper)                    | 2.11.5         | Headless, extensible HTML rich-text editing                   |
| **State Management** | TanStack Query v5 + Zustand                     | 5.75.0 / 4.5.7 | Async server state management (TanStack) & global UI state (Zustand) |
| **Backend Runtime**  | Node.js                                         | 22.16.0 (LTS)  | Asynchronous JS runtime                                       |
| **Web Framework**    | Express                                         | 5.1.0          | Minimal, robust HTTP server and middleware framework          |
| **Database**         | PostgreSQL                                      | 16.8           | Relational storage with native full-text search (`tsvector`)  |
| **ORM**              | Prisma                                          | 6.6.0          | Type-safe query building, database migrations, client generation |
| **Validation**       | Zod                                             | 3.24.4         | Schema definition and validation in shared package & runtime |
| **Password Hashing** | `bcrypt`                                        | 5.1.1          | Adaptive cryptographic password hashing                       |
| **Testing (Unit)**   | Vitest                                          | 3.2.1          | Fast, TypeScript-native unit & integration test runner        |
| **Testing (API)**    | Supertest                                       | 7.1.0          | HTTP assertion library for Express integration tests          |
| **Testing (E2E)**    | Playwright                                      | 1.52.0         | Cross-browser end-to-end testing framework                    |

> **IMPORTANT:** All versions above are PINNED. Use exact versions (`"5.9.2"`) in `package.json`, NOT ranges (`"^5.9.2"` or `"~5.9.2"`). This prevents version drift across developer environments and CI.

### 3.1 Pinned Dependency Manifests

#### 3.1.1 `packages/shared/package.json` — Dependencies

```json
{
  "name": "@note-app/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/"
  },
  "dependencies": {
    "zod": "3.24.4"
  },
  "devDependencies": {
    "typescript": "5.9.2"
  }
}
```

#### 3.1.2 `apps/backend/package.json` — Dependencies

```json
{
  "name": "@note-app/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@note-app/shared": "workspace:*",
    "@prisma/client": "6.6.0",
    "bcrypt": "5.1.1",
    "cors": "2.8.5",
    "express": "5.1.0",
    "express-rate-limit": "7.5.0",
    "helmet": "8.0.0",
    "jsonwebtoken": "9.0.2",
    "zod": "3.24.4"
  },
  "devDependencies": {
    "@types/bcrypt": "5.0.2",
    "@types/cors": "2.8.17",
    "@types/express": "5.0.0",
    "@types/jsonwebtoken": "9.0.9",
    "@types/node": "22.15.0",
    "@types/supertest": "6.0.2",
    "prisma": "6.6.0",
    "supertest": "7.1.0",
    "tsx": "4.19.0",
    "typescript": "5.9.2",
    "vitest": "3.2.1"
  }
}
```

#### 3.1.3 `apps/frontend/package.json` — Dependencies

```json
{
  "name": "@note-app/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@note-app/shared": "workspace:*",
    "@radix-ui/react-dialog": "1.1.6",
    "@radix-ui/react-dropdown-menu": "2.1.6",
    "@radix-ui/react-popover": "1.1.6",
    "@radix-ui/react-toast": "1.2.6",
    "@radix-ui/react-tooltip": "1.1.8",
    "@tanstack/react-query": "5.75.0",
    "@tiptap/extension-character-count": "2.11.5",
    "@tiptap/extension-code-block-lowlight": "2.11.5",
    "@tiptap/extension-highlight": "2.11.5",
    "@tiptap/extension-link": "2.11.5",
    "@tiptap/extension-placeholder": "2.11.5",
    "@tiptap/extension-task-item": "2.11.5",
    "@tiptap/extension-task-list": "2.11.5",
    "@tiptap/extension-text-align": "2.11.5",
    "@tiptap/extension-typography": "2.11.5",
    "@tiptap/extension-underline": "2.11.5",
    "@tiptap/react": "2.11.5",
    "@tiptap/starter-kit": "2.11.5",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lowlight": "3.3.0",
    "lucide-react": "0.475.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-router-dom": "7.5.0",
    "tailwind-merge": "3.0.2",
    "tailwindcss-animate": "1.0.7",
    "zod": "3.24.4",
    "zustand": "4.5.7"
  },
  "devDependencies": {
    "@playwright/test": "1.52.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.3.0",
    "@types/react": "19.1.0",
    "@types/react-dom": "19.1.0",
    "@vitejs/plugin-react": "4.4.0",
    "autoprefixer": "10.4.21",
    "jsdom": "26.1.0",
    "postcss": "8.5.3",
    "tailwindcss": "3.4.19",
    "typescript": "5.9.2",
    "vite": "6.0.11",
    "vitest": "3.2.1"
  }
}
```

#### 3.1.4 Root `devDependencies`

```json
{
  "devDependencies": {
    "@commitlint/cli": "19.8.0",
    "@commitlint/config-conventional": "19.8.0",
    "@typescript-eslint/eslint-plugin": "8.30.0",
    "@typescript-eslint/parser": "8.30.0",
    "eslint": "9.25.0",
    "eslint-config-prettier": "10.1.2",
    "husky": "9.1.7",
    "prettier": "3.5.3",
    "typescript": "5.9.2"
  }
}
```


---

## 4. Architectural Patterns

The application follows clean, modular architectural patterns:

1. **Monorepo Workspaces**: Separation of concerns via distinct workspace packages (`packages/shared`, `apps/backend`, `apps/frontend`).
2. **Layered Architecture (Backend)**: Strict request lifecycle separation across Routers, Middleware, Controllers, Services, and Prisma Repository layers.
3. **Feature-Based Architecture (Frontend)**: Modular component organization grouped by domain functionality (auth, notes, tags, search, share, version history).
4. **Single Source of Truth Validation**: Centralized Zod schemas in `packages/shared` ensuring schema parity between client-side form validation and server-side request parsing.
5. **Stateless JWT + Stateful Refresh Session**: Fast stateless request authorization combined with database-backed refresh tokens for dynamic session control and security.

---

## 5. Directory & Repository Structure

```
note-taking-app/
├── docs/
│   ├── FRS.md
│   ├── SDS.md
│   └── UX.md
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── constants/
│       │   │   ├── defaults.ts
│       │   │   ├── errors.ts
│       │   │   └── limits.ts
│       │   ├── schemas/
│       │   │   ├── auth.schemas.ts
│       │   │   ├── note.schemas.ts
│       │   │   ├── common.schemas.ts
│       │   │   ├── search.schemas.ts
│       │   │   ├── share.schemas.ts
│       │   │   ├── tag.schemas.ts
│       │   │   └── version.schemas.ts
│       │   ├── types/
│       │   │   ├── auth.types.ts
│       │   │   ├── common.types.ts
│       │   │   ├── error.types.ts
│       │   │   ├── note.types.ts
│       │   │   ├── search.types.ts
│       │   │   ├── share.types.ts
│       │   │   ├── tag.types.ts
│       │   │   └── version.types.ts
│       │   ├── utils/
│       │   │   ├── validation.ts
│       │   │   └── formatting.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── notes/
│   │   │   │   ├── tags/
│   │   │   │   ├── search/
│   │   │   │   ├── share/
│   │   │   │   └── versions/
│   │   │   ├── utils/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── CLAUDE.md
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/               # Radix/shadcn primitives
│       │   │   └── common/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── notes/
│       │   │   ├── tags/
│       │   │   ├── search/
│       │   │   ├── share/
│       │   │   └── versions/
│       │   ├── hooks/                 # Custom React hooks
│       │   ├── lib/                   # Utility libraries
│       │   ├── pages/                 # Route pages
│       │   ├── stores/                # Zustand stores
│       │   ├── styles/                # Global styles
│       │   ├── App.tsx                # Root component
│       │   └── main.tsx               # Entry point
│       ├── tests/
│       │   ├── unit/
│       │   └── e2e/                   # Playwright tests
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── CLAUDE.md
├── AGENTS.md                      # Universal AI context
├── CLAUDE.md                      # Claude-specific rules
├── pnpm-workspace.yaml
├── package.json                   # Root package.json
├── tsconfig.base.json             # Shared TS config
├── .eslintrc.cjs                  # Shared ESLint config
├── .prettierrc                    # Prettier config
├── .husky/                        # Git hooks
│   ├── pre-commit
│   └── commit-msg
├── commitlint.config.cjs
└── .gitignore
```

---

## 6. Application Layers

### 6.1 Backend Layer Architecture

The backend follows a modular layered architecture within each feature module:

```mermaid
graph TB
    Request["HTTP Request"] --> Router["Router Layer"]
    Router --> Validation["Validation Middleware (Zod)"]
    Validation --> Controller["Controller Layer"]
    Controller --> Service["Service Layer"]
    Service --> Repository["Prisma Client (Repository)"]
    Repository --> DB["PostgreSQL"]
    
    Service --> |"Errors"| ErrorHandler["Error Handler Middleware"]
    ErrorHandler --> Response["HTTP Response"]
    Controller --> Response
```

| Layer          | Responsibility                                                                |
| -------------- | ----------------------------------------------------------------------------- |
| **Router**     | Defines routes and HTTP methods; delegates to controllers.                   |
| **Validation** | Validates request body, query, and params using Zod schemas from `shared`.   |
| **Controller** | Extracts validated data; calls service methods; formats HTTP responses.       |
| **Service**    | Contains business logic; orchestrates operations; throws domain errors.      |
| **Prisma**     | Data access through Prisma Client; no raw SQL except for full-text search.   |
| **Middleware**  | Cross-cutting concerns: auth, logging, error handling, rate limiting, CORS.  |

### 6.2 Module Structure

Each backend module follows this structure:

```
modules/
└── notes/
    ├── notes.router.ts       # Route definitions
    ├── notes.controller.ts   # HTTP request handling
    ├── notes.service.ts      # Business logic
    └── notes.errors.ts       # Module-specific error classes
```

---

## 7. Backend Architecture

### 7.1 Express Application Setup

The Express application is configured with the following middleware stack (order matters):

```mermaid
graph LR
    A["Request"] --> B["Helmet (Security Headers)"]
    B --> C["CORS"]
    C --> D["JSON Body Parser (500 KB limit)"]
    D --> E["Request Logger"]
    E --> F["Rate Limiter"]
    F --> G["Route Handler"]
    G --> H["Error Handler"]
    H --> I["Response"]
```

### 7.2 Configuration Management

Application configuration SHALL be managed via environment variables with a validated config module:

| Variable                  | Required | Default         | Description                           |
| ------------------------- | -------- | --------------- | ------------------------------------- |
| `NODE_ENV`                | No       | `development`   | Runtime environment                   |
| `PORT`                    | No       | `3000`          | Server port                           |
| `DATABASE_URL`            | Yes      | —               | PostgreSQL connection string          |
| `JWT_SECRET`              | Yes      | —               | JWT signing key (min 256 bits)        |
| `JWT_ACCESS_EXPIRY`       | No       | `15m`           | Access token expiration               |
| `JWT_REFRESH_EXPIRY`      | No       | `7d`            | Refresh token expiration              |
| `CORS_ORIGIN`             | Yes      | —               | Allowed frontend origin               |
| `BCRYPT_ROUNDS`           | No       | `12`            | Bcrypt cost factor                    |
| `OTP_EXPIRY_MINUTES`      | No       | `10`            | OTP validity period                   |
| `RESET_TOKEN_EXPIRY_MIN`  | No       | `15`            | Password reset token validity         |
| `SHARE_DEFAULT_EXPIRY_HRS`| No       | `168`           | Default share link expiry (7 days)    |
| `VERSION_PURGE_DAYS`      | No       | `90`            | Version snapshot purge threshold      |
| `VERSION_MIN_RETAIN`      | No       | `10`            | Minimum versions to retain per note   |
| `LOG_LEVEL`               | No       | `info`          | Logging level                         |

All environment variables SHALL be validated at startup using Zod. The application MUST fail fast with a descriptive error if required variables are missing.

---

## 8. Frontend Architecture

### 8.1 Component Hierarchy & Traceability

The frontend follows a feature-based architecture with clear mappings to UX Screens and Functional Requirements:

- **Pages** — Route-level components that compose features.
- **Features** — Self-contained feature modules (auth, notes, tags, etc.) containing components, hooks, and API calls.
- **Components** — Reusable UI components built on shadcn/ui primitives.
- **Stores** — Zustand stores for client-side state.
- **Hooks** — Custom React hooks for shared behavior.

```mermaid
graph TB
    subgraph Pages
        LoginPage["LoginPage (UX-SCR-002)"]
        RegisterPage["RegisterPage (UX-SCR-001)"]
        DashboardPage["DashboardPage (UX-SCR-006)"]
        EditorPage["EditorPage (UX-SCR-007)"]
        SharedNotePage["SharedNotePage (UX-SCR-013)"]
    end

    subgraph Features
        AuthFeature["Auth Feature (FR-AUTH-*, FR-PWD-*)"]
        NotesFeature["Notes Feature (FR-NOTE-*)"]
        TagsFeature["Tags Feature (FR-TAG-*)"]
        SearchFeature["Search Feature (FR-SRCH-*)"]
        ShareFeature["Share Feature (FR-SHARE-*)"]
        VersionFeature["Version Feature (FR-VER-*)"]
    end

    subgraph State
        TanStackState["TanStack Query (Server State)"]
        ZustandState["Zustand (UI State)"]
    end

    Pages --> Features
    Features --> State
    Features --> API["API Client"]
    API --> |"HTTP"| Backend["Backend API"]
```

#### 8.1.1 Related Frontend Components Matrix

| Component Directory | Main Components / UI Elements | Related Requirements | Related UX Screens |
| ------------------- | ----------------------------- | -------------------- | ------------------ |
| `features/auth/`    | `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `OtpForm`, `ResetPasswordForm` | FR-AUTH-001 – FR-AUTH-004, FR-PWD-001 – FR-PWD-003 | UX-SCR-001 – UX-SCR-005 |
| `features/notes/`   | `NotesList`, `NoteCard`, `NoteEditor`, `TipTapToolbar`, `DeleteNoteDialog` | FR-NOTE-001 – FR-NOTE-006 | UX-SCR-006, UX-SCR-007, UX-SCR-008 |
| `features/tags/`    | `TagChip`, `SidebarTagList`, `TagManagementModal`, `TagColorPicker` | FR-TAG-001 – FR-TAG-004 | UX-SCR-006, UX-SCR-010 |
| `features/search/`  | `SearchBar`, `SearchResultsView`, `SnippetHighlight` | FR-SRCH-001 | UX-SCR-006, UX-SCR-009 |
| `features/share/`   | `ShareModal`, `PublicSharedView` | FR-SHARE-001 – FR-SHARE-004 | UX-SCR-011, UX-SCR-013 |
| `features/versions/`| `VersionHistoryDrawer`, `VersionPreviewBanner`, `VersionItem` | FR-VER-001 – FR-VER-004 | UX-SCR-012 |

### 8.2 Routing Structure

| Route                        | Component         | Auth Required | Description                     |
| ---------------------------- | ----------------- | ------------- | ------------------------------- |
| `/login`                     | LoginPage         | No            | User login                      |
| `/register`                  | RegisterPage      | No            | User registration               |
| `/forgot-password`           | ForgotPasswordPage| No            | Request OTP                     |
| `/verify-otp`               | VerifyOtpPage     | No            | Enter OTP code                  |
| `/reset-password`            | ResetPasswordPage | No            | Set new password                |
| `/`                          | DashboardPage     | Yes           | Notes list (default)            |
| `/notes/new`                 | EditorPage        | Yes           | Create new note                 |
| `/notes/:id`                 | EditorPage        | Yes           | Edit existing note              |
| `/shared/:token`             | SharedNotePage    | No            | Public shared note view         |

### 8.3 API Client

The frontend SHALL use a centralized API client built on `fetch` that:

1. Automatically attaches the JWT access token to all authenticated requests.
2. Intercepts 401 responses and attempts automatic token refresh.
3. Redirects to login if token refresh fails.
4. Parses error responses into typed error objects.
5. Provides typed request/response helpers using types from `packages/shared`.

---

## 9. Shared Package Design

### 9.1 Purpose

The `packages/shared` package is the single source of truth for all data contracts shared between frontend and backend. **No type or schema SHALL be duplicated** in frontend or backend packages (CON-003).

### 9.2 Contents

```
packages/shared/src/
├── types/
│   ├── auth.types.ts           # User, LoginRequest, LoginResponse, etc.
│   ├── note.types.ts           # Note, CreateNoteRequest, NoteListResponse, etc.
│   ├── tag.types.ts            # Tag, CreateTagRequest, etc.
│   ├── search.types.ts         # SearchRequest, SearchResult, etc.
│   ├── share.types.ts          # ShareLink, CreateShareRequest, etc.
│   ├── version.types.ts        # NoteVersion, VersionListResponse, etc.
│   ├── common.types.ts         # PaginationParams, PaginatedResponse, etc.
│   └── error.types.ts          # ApiError, ValidationError, ErrorCode enum
├── schemas/
│   ├── auth.schemas.ts         # Zod schemas for auth requests
│   ├── note.schemas.ts         # Zod schemas for note requests
│   ├── tag.schemas.ts          # Zod schemas for tag requests
│   ├── search.schemas.ts       # Zod schemas for search requests
│   ├── share.schemas.ts        # Zod schemas for share requests
│   ├── version.schemas.ts      # Zod schemas for version requests
│   └── common.schemas.ts       # Zod schemas for pagination, etc.
├── constants/
│   ├── errors.ts               # Error code constants
│   ├── limits.ts               # Validation limits (max lengths, etc.)
│   └── defaults.ts             # Default values
└── utils/
    ├── validation.ts           # Validation helpers
    └── formatting.ts           # Shared formatting utilities
```

### 9.3 Key Design Rules

1. Types are inferred from Zod schemas where possible (`z.infer<typeof schema>`).
2. The package is published as ESM with TypeScript declarations.
3. No runtime dependencies beyond Zod.
4. Barrel exports via `index.ts` for clean imports.

---

## 10. Authentication Design

### 10.1 Overview

Authentication uses a stateless JWT access token for request authentication and a stateful refresh token stored in the database for session management. This hybrid approach provides:

- Fast, stateless request validation (JWT).
- Secure session revocation capability (database-backed refresh tokens).
- Token rotation to mitigate refresh token theft.

### 10.2 Token Specifications

| Token          | Type     | Storage (Server) | Storage (Client) | Lifetime | Payload                          |
| -------------- | -------- | ----------------- | ----------------- | -------- | -------------------------------- |
| Access Token   | JWT      | Not stored        | Memory (variable) | 15 min   | userId, email, iat, exp          |
| Refresh Token  | Opaque   | Database (hashed) | Memory (variable) | 7 days   | N/A (lookup by token hash)       |

### 10.3 Password Hashing

- Algorithm: bcrypt
- Cost factor: 12 (minimum; configurable via `BCRYPT_ROUNDS`)
- Salt: Automatically generated by bcrypt
- Storage: Only the hash is stored; plain-text password is never persisted

---

## 11. JWT & Refresh Token Flow

### 11.1 Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database

    C->>S: POST /api/auth/login {email, password}
    S->>DB: Find user by email
    DB-->>S: User record
    S->>S: Compare password hash (bcrypt)
    S->>S: Generate JWT access token (15 min)
    S->>S: Generate refresh token (random bytes)
    S->>DB: Store hashed refresh token with expiry
    S-->>C: {accessToken, refreshToken, user}
```

### 11.2 Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database

    C->>S: POST /api/auth/refresh {refreshToken}
    S->>DB: Find refresh token (by hash)
    DB-->>S: Token record (or not found)
    alt Token valid and not expired
        S->>DB: Delete used refresh token
        S->>S: Generate new JWT access token
        S->>S: Generate new refresh token
        S->>DB: Store new hashed refresh token
        S-->>C: {accessToken, refreshToken}
    else Token invalid or expired
        S-->>C: 401 Unauthorized
    end
```

### 11.3 Automatic Refresh (Client-Side)

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Client
    participant S as Server

    C->>API: API Request
    API->>S: Request with accessToken
    S-->>API: 401 Token Expired
    API->>S: POST /api/auth/refresh {refreshToken}
    alt Refresh succeeds
        S-->>API: New {accessToken, refreshToken}
        API->>S: Retry original request with new accessToken
        S-->>API: Original response
        API-->>C: Response
    else Refresh fails
        API-->>C: Redirect to login
    end
```

---

## 12. Authorization Rules

| Rule | Description                                                                              | Related Requirements |
| ---- | ---------------------------------------------------------------------------------------- | -------------------- |
| AZ-01| All endpoints except public routes require a valid JWT access token in the `Authorization: Bearer <token>` header. | All FRs              |
| AZ-02| Public routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/forgot-password`, `POST /api/auth/verify-otp`, `POST /api/auth/reset-password`, `GET /api/shared/:token`. | FR-AUTH-*, FR-PWD-*, FR-SHARE-002 |
| AZ-03| Every database query for user-owned resources MUST include a `WHERE userId = <authenticatedUserId>` clause. | SEC-006, BR-002      |
| AZ-04| Accessing a resource owned by another user MUST return 404, not 403 (to prevent enumeration). | SEC-007              |
| AZ-05| The `userId` is extracted from the JWT payload by the auth middleware. It MUST NOT be accepted from request body or query parameters. | SEC-006              |

---

## 13. Database Design

### 13.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Note : "owns"
    User ||--o{ Tag : "owns"
    User ||--o{ RefreshToken : "has"
    User ||--o{ PasswordResetOtp : "has"
    Note ||--o{ NoteVersion : "has versions"
    Note ||--o| ShareLink : "has share link"
    Note }o--o{ Tag : "tagged with"

    User {
        uuid id PK
        string name
        string email UK
        string passwordHash
        timestamp createdAt
        timestamp updatedAt
    }

    Note {
        uuid id PK
        uuid userId FK
        string title
        text content
        text contentPlain
        tsvector searchVector
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    Tag {
        uuid id PK
        uuid userId FK
        string name
        string color
        timestamp createdAt
        timestamp updatedAt
    }

    NoteTag {
        uuid noteId FK
        uuid tagId FK
    }

    NoteVersion {
        uuid id PK
        uuid noteId FK
        int versionNumber
        string title
        text content
        timestamp createdAt
    }

    ShareLink {
        uuid id PK
        uuid noteId FK
        string token UK
        int viewCount
        timestamp expiresAt
        timestamp createdAt
    }

    RefreshToken {
        uuid id PK
        uuid userId FK
        string tokenHash
        timestamp expiresAt
        timestamp createdAt
    }

    PasswordResetOtp {
        uuid id PK
        uuid userId FK
        string otpHash
        timestamp expiresAt
        boolean used
        timestamp createdAt
    }
```

### 13.2 Table Details

#### 13.2.1 User

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `name`         | VARCHAR(100)    | NOT NULL                       | User display name               |
| `email`        | VARCHAR(255)    | NOT NULL, UNIQUE               | Stored lowercase                |
| `passwordHash` | VARCHAR(255)    | NOT NULL                       | bcrypt hash                     |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Account creation time           |
| `updatedAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Last update time                |

**Indexes:**
- `idx_user_email` — UNIQUE on `email`

#### 13.2.2 Note

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `userId`       | UUID            | FK → User.id, NOT NULL         | Note owner                      |
| `title`        | VARCHAR(255)    | NOT NULL, default 'Untitled'   | Note title                      |
| `content`      | TEXT            | NOT NULL, default ''           | Rich-text HTML content          |
| `contentPlain` | TEXT            | NOT NULL, default ''           | Plain-text extracted from HTML  |
| `searchVector` | TSVECTOR        | —                              | Full-text search vector         |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Creation time                   |
| `updatedAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Last update time                |
| `deletedAt`    | TIMESTAMPTZ     | NULL                           | Soft-delete timestamp           |

**Indexes:**
- `idx_note_user_id` — B-tree on `userId`
- `idx_note_user_deleted` — B-tree on `(userId, deletedAt)` for efficient filtered queries
- `idx_note_search_vector` — GIN on `searchVector` for full-text search
- `idx_note_user_updated` — B-tree on `(userId, updatedAt DESC)` for default sorting

#### 13.2.3 Tag

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `userId`       | UUID            | FK → User.id, NOT NULL         | Tag owner                       |
| `name`         | VARCHAR(50)     | NOT NULL                       | Tag name                        |
| `color`        | CHAR(7)         | NOT NULL, default '#6B7280'    | Hex color code                  |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Creation time                   |
| `updatedAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Last update time                |

**Indexes:**
- `idx_tag_user_name` — UNIQUE on `(userId, LOWER(name))` for case-insensitive uniqueness

#### 13.2.4 NoteTag (Join Table)

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `noteId`       | UUID            | FK → Note.id, NOT NULL         | Note reference                  |
| `tagId`        | UUID            | FK → Tag.id, NOT NULL          | Tag reference                   |

**Indexes:**
- `pk_note_tag` — Composite PK on `(noteId, tagId)`
- `idx_note_tag_tag_id` — B-tree on `tagId` for reverse lookups

**Cascade Behavior:**
- Deleting a Tag → cascade deletes NoteTag rows
- Deleting a Note (hard delete, post-30-day purge) → cascade deletes NoteTag rows

#### 13.2.5 NoteVersion

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `noteId`       | UUID            | FK → Note.id, NOT NULL         | Parent note                     |
| `versionNumber`| INTEGER         | NOT NULL                       | Auto-incrementing per note      |
| `title`        | VARCHAR(255)    | NOT NULL                       | Title snapshot                  |
| `content`      | TEXT            | NOT NULL                       | Content snapshot                |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Snapshot creation time          |

**Indexes:**
- `idx_version_note_id` — B-tree on `noteId`
- `idx_version_note_number` — UNIQUE on `(noteId, versionNumber)`

#### 13.2.6 ShareLink

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `noteId`       | UUID            | FK → Note.id, NOT NULL, UNIQUE | One share link per note         |
| `token`        | VARCHAR(64)     | NOT NULL, UNIQUE               | Public share token (UUID v4)    |
| `viewCount`    | INTEGER         | NOT NULL, default 0            | Atomic view counter             |
| `expiresAt`    | TIMESTAMPTZ     | NOT NULL                       | Link expiry timestamp           |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Creation time                   |

**Indexes:**
- `idx_share_token` — UNIQUE on `token`
- `idx_share_note_id` — UNIQUE on `noteId`

#### 13.2.7 RefreshToken

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `userId`       | UUID            | FK → User.id, NOT NULL         | Token owner                     |
| `tokenHash`    | VARCHAR(255)    | NOT NULL                       | SHA-256 hash of the token       |
| `expiresAt`    | TIMESTAMPTZ     | NOT NULL                       | Token expiry timestamp          |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Creation time                   |

**Indexes:**
- `idx_refresh_token_hash` — UNIQUE on `tokenHash`
- `idx_refresh_user_id` — B-tree on `userId` for bulk deletion

#### 13.2.8 PasswordResetOtp

| Column         | Type            | Constraints                    | Notes                           |
| -------------- | --------------- | ------------------------------ | ------------------------------- |
| `id`           | UUID            | PK, default gen_random_uuid()  | Primary key                     |
| `userId`       | UUID            | FK → User.id, NOT NULL         | User requesting reset           |
| `otpHash`      | VARCHAR(255)    | NOT NULL                       | SHA-256 hash of the OTP         |
| `expiresAt`    | TIMESTAMPTZ     | NOT NULL                       | OTP expiry timestamp            |
| `used`         | BOOLEAN         | NOT NULL, default FALSE        | Whether OTP has been consumed   |
| `createdAt`    | TIMESTAMPTZ     | NOT NULL, default NOW()        | Creation time                   |

**Indexes:**
- `idx_otp_user_id` — B-tree on `userId`

### 13.3 Database Entity Traceability

| Entity Name          | Supported Requirement IDs                      | Primary Access Operations                            |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| **`User`**           | FR-AUTH-001, FR-AUTH-002, FR-PWD-003           | Create user, Lookup by email, Update passwordHash    |
| **`RefreshToken`**   | FR-AUTH-002, FR-AUTH-003, FR-AUTH-004, FR-PWD-003 | Create session, Rotate token, Delete session(s)     |
| **`PasswordResetOtp`**| FR-PWD-001, FR-PWD-002                         | Store OTP hash, Verify & invalidate OTP              |
| **`Note`**           | FR-NOTE-001 – FR-NOTE-006, FR-SRCH-001         | Full CRUD, Soft delete (`deletedAt`), FTS query      |
| **`Tag`**            | FR-TAG-001 – FR-TAG-004, FR-NOTE-006           | Create, List with note counts, Update, Hard delete   |
| **`NoteTag`**        | FR-NOTE-001, FR-NOTE-003, FR-NOTE-006, FR-TAG-004| Associate/disassociate tags with notes               |
| **`NoteVersion`**    | FR-VER-001 – FR-VER-005                        | Insert immutable snapshot, List versions, Restore    |
| **`ShareLink`**      | FR-SHARE-001 – FR-SHARE-004                    | Create token link, Public read & atomic view increment, Revoke |

---

## 14. Entity Relationships

| Relationship             | Type          | Description                                                 |
| ------------------------ | ------------- | ----------------------------------------------------------- |
| User → Note              | One-to-Many   | A user owns zero or more notes.                             |
| User → Tag               | One-to-Many   | A user owns zero or more tags.                              |
| User → RefreshToken      | One-to-Many   | A user can have multiple active refresh tokens.             |
| User → PasswordResetOtp  | One-to-Many   | A user can have multiple OTP records (only latest is valid).|
| Note → NoteVersion       | One-to-Many   | A note has one or more version snapshots.                   |
| Note → ShareLink         | One-to-One    | A note can have at most one active share link.              |
| Note ↔ Tag               | Many-to-Many  | Notes and tags have a many-to-many relationship via NoteTag.|

---

## 15. Prisma Model Overview

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(uuid()) @db.Uuid
  name          String   @db.VarChar(100)
  email         String   @unique @db.VarChar(255)
  passwordHash  String   @db.VarChar(255)
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz

  notes          Note[]
  tags           Tag[]
  refreshTokens  RefreshToken[]
  passwordResets PasswordResetOtp[]
}

model Note {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @db.Uuid
  title         String    @default("Untitled") @db.VarChar(255)
  content       String    @default("") @db.Text
  contentPlain  String    @default("") @db.Text
  createdAt     DateTime  @default(now()) @db.Timestamptz
  updatedAt     DateTime  @updatedAt @db.Timestamptz
  deletedAt     DateTime? @db.Timestamptz

  user      User          @relation(fields: [userId], references: [id])
  tags      NoteTag[]
  versions  NoteVersion[]
  shareLink ShareLink?

  @@index([userId, deletedAt])
  @@index([userId, updatedAt(sort: Desc)])
}

model Tag {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  name      String   @db.VarChar(50)
  color     String   @default("#6B7280") @db.Char(7)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  user  User      @relation(fields: [userId], references: [id])
  notes NoteTag[]

  @@unique([userId, name])
  @@index([userId])
}

model NoteTag {
  noteId String @db.Uuid
  tagId  String @db.Uuid

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
  @@index([tagId])
}

model NoteVersion {
  id            String   @id @default(uuid()) @db.Uuid
  noteId        String   @db.Uuid
  versionNumber Int
  title         String   @db.VarChar(255)
  content       String   @db.Text
  createdAt     DateTime @default(now()) @db.Timestamptz

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)

  @@unique([noteId, versionNumber])
  @@index([noteId])
}

model ShareLink {
  id        String   @id @default(uuid()) @db.Uuid
  noteId    String   @unique @db.Uuid
  token     String   @unique @db.VarChar(64)
  viewCount Int      @default(0)
  expiresAt DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  tokenHash String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz
  createdAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetOtp {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  otpHash   String   @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz
  used      Boolean  @default(false)
  createdAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

> **Note:** The `searchVector` column (`TSVECTOR` type) requires a raw SQL migration since Prisma does not natively support the `tsvector` type. A migration script SHALL create this column, the GIN index, and a trigger to automatically update the search vector when `contentPlain` changes.

---

## 16. API Design Standards

### 16.1 URL Conventions

- Base path: `/api`
- Resource-oriented: `/api/<resource>` (plural nouns)
- Nested resources: `/api/<parent>/:parentId/<child>`
- All paths are lowercase with hyphens for multi-word resources.
- Version prefix is NOT used (single version for MVP).

### 16.2 HTTP Methods

| Method   | Semantics                                   | Response on Success |
| -------- | ------------------------------------------- | ------------------- |
| `GET`    | Retrieve resource(s)                        | 200 OK              |
| `POST`   | Create a new resource                       | 201 Created         |
| `PATCH`  | Partially update a resource                 | 200 OK              |
| `DELETE` | Remove a resource (soft or hard as defined) | 200 OK              |

### 16.3 Naming Conventions

- Request fields: `camelCase`
- Response fields: `camelCase`
- Database columns: `camelCase` (Prisma default)
- URL path segments: `kebab-case`
- Query parameters: `camelCase`

---

## 17. REST Endpoint Specifications

### 17.1 Authentication Endpoints

**Related Requirements:** FR-AUTH-001, FR-AUTH-002, FR-AUTH-003, FR-AUTH-004, FR-PWD-001, FR-PWD-002, FR-PWD-003

| Method | Path                        | Description              | Auth Required | Request Body                    | Success Response                 |
| ------ | --------------------------- | ------------------------ | ------------- | ------------------------------- | -------------------------------- |
| POST   | `/api/auth/register`        | Register new user        | No            | `{name, email, password}`       | 201: `{user: {id, name, email}}` |
| POST   | `/api/auth/login`           | Login                    | No            | `{email, password}`             | 200: `{accessToken, refreshToken, user}` |
| POST   | `/api/auth/refresh`         | Refresh tokens           | No            | `{refreshToken}`                | 200: `{accessToken, refreshToken}` |
| POST   | `/api/auth/logout`          | Logout                   | Yes           | `{refreshToken}`                | 200: `{message}`                 |
| POST   | `/api/auth/forgot-password` | Request OTP              | No            | `{email}`                       | 200: `{message}`                 |
| POST   | `/api/auth/verify-otp`      | Verify OTP               | No            | `{email, otp}`                  | 200: `{resetToken}`              |
| POST   | `/api/auth/reset-password`  | Reset password           | No            | `{resetToken, newPassword}`     | 200: `{message}`                 |
| GET    | `/api/auth/me`              | Get current user profile | Yes           | —                               | 200: `{user: {id, name, email}}` |

### 17.2 Notes Endpoints

**Related Requirements:** FR-NOTE-001, FR-NOTE-002, FR-NOTE-003, FR-NOTE-004, FR-NOTE-005, FR-NOTE-006

| Method | Path                            | Description             | Auth Required | Request Body / Query                                      | Success Response                    |
| ------ | ------------------------------- | ----------------------- | ------------- | --------------------------------------------------------- | ----------------------------------- |
| GET    | `/api/notes`                    | List user's notes       | Yes           | Query: `page, pageSize, sortBy, sortOrder, tagIds, includeTrashed` | 200: `{data, pagination}`          |
| POST   | `/api/notes`                    | Create note             | Yes           | `{title?, content?, tagIds?}`                              | 201: `{note}`                       |
| GET    | `/api/notes/:id`                | Get note by ID          | Yes           | —                                                          | 200: `{note}`                       |
| PATCH  | `/api/notes/:id`                | Update note             | Yes           | `{title?, content?, tagIds?}`                              | 200: `{note}`                       |
| DELETE | `/api/notes/:id`                | Soft-delete note        | Yes           | —                                                          | 200: `{message}`                    |
| POST   | `/api/notes/:id/restore`        | Restore soft-deleted    | Yes           | —                                                          | 200: `{note}`                       |

### 17.3 Tags Endpoints

**Related Requirements:** FR-TAG-001, FR-TAG-002, FR-TAG-003, FR-TAG-004

| Method | Path                | Description             | Auth Required | Request Body              | Success Response              |
| ------ | ------------------- | ----------------------- | ------------- | ------------------------- | ----------------------------- |
| GET    | `/api/tags`         | List user's tags        | Yes           | —                         | 200: `{tags}`                 |
| POST   | `/api/tags`         | Create tag              | Yes           | `{name, color?}`          | 201: `{tag}`                  |
| PATCH  | `/api/tags/:id`     | Update tag              | Yes           | `{name?, color?}`         | 200: `{tag}`                  |
| DELETE | `/api/tags/:id`     | Delete tag              | Yes           | —                         | 200: `{message}`              |

### 17.4 Search Endpoints

**Related Requirements:** FR-SRCH-001

| Method | Path                | Description             | Auth Required | Query Params                   | Success Response              |
| ------ | ------------------- | ----------------------- | ------------- | ------------------------------ | ----------------------------- |
| GET    | `/api/search`       | Full-text search        | Yes           | `q, page, pageSize, tagIds`    | 200: `{data, pagination}`     |

### 17.5 Share Endpoints

**Related Requirements:** FR-SHARE-001, FR-SHARE-002, FR-SHARE-003, FR-SHARE-004

| Method | Path                           | Description             | Auth Required | Request Body / Params           | Success Response              |
| ------ | ------------------------------ | ----------------------- | ------------- | ------------------------------- | ----------------------------- |
| POST   | `/api/notes/:id/share`         | Generate share link     | Yes           | `{expiresInHours?}`             | 201: `{shareLink}`            |
| DELETE | `/api/notes/:id/share`         | Revoke share link       | Yes           | —                               | 200: `{message}`              |
| GET    | `/api/shares`                  | List active share links | Yes           | —                               | 200: `{shares}`               |
| GET    | `/api/shared/:token`           | Access shared note      | No            | —                               | 200: `{note}`                 |

### 17.6 Version History Endpoints

**Related Requirements:** FR-VER-001, FR-VER-002, FR-VER-003, FR-VER-004, FR-VER-005

| Method | Path                                         | Description         | Auth Required | Request Body | Success Response            |
| ------ | -------------------------------------------- | ------------------- | ------------- | ------------ | --------------------------- |
| GET    | `/api/notes/:id/versions`                    | List versions       | Yes           | —            | 200: `{versions}`           |
| GET    | `/api/notes/:id/versions/:versionNumber`     | View version        | Yes           | —            | 200: `{version}`            |
| POST   | `/api/notes/:id/versions/:versionNumber/restore` | Restore version | Yes           | —            | 200: `{note}`               |

---

## 18. Request/Response Standards

### 18.1 Successful Single Resource Response

```json
{
  "note": {
    "id": "uuid",
    "title": "string",
    "content": "string",
    "tags": [
      {
        "id": "uuid",
        "name": "string",
        "color": "#RRGGBB"
      }
    ],
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
}
```

### 18.2 Successful List Response (Paginated)

```json
{
  "data": [
    { "...resource..." }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```

### 18.3 Successful Message Response

```json
{
  "message": "Operation completed successfully."
}
```

---

## 19. Error Response Standards

### 19.1 Standard Error Format

All error responses SHALL follow this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message.",
    "details": []
  }
}
```

### 19.2 Validation Error Format (422)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format."
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters."
      }
    ]
  }
}
```

### 19.3 HTTP Status Code Usage

| Status Code | Usage                                                   |
| ----------- | ------------------------------------------------------- |
| 200         | Successful retrieval, update, or delete                 |
| 201         | Successful resource creation                            |
| 401         | Authentication failure (missing/invalid/expired token)  |
| 404         | Resource not found or unauthorized access               |
| 405         | HTTP method not allowed                                 |
| 409         | Conflict (duplicate email, duplicate tag name, etc.)    |
| 410         | Resource gone (expired OTP, expired share link, etc.)   |
| 413         | Payload too large (note content exceeds size limit)     |
| 422         | Validation error (field-level errors)                   |
| 429         | Rate limit exceeded                                     |
| 500         | Internal server error (unexpected)                      |

> **Cross-Reference Note:** All exact error code strings and their corresponding HTTP status codes are canonically defined in **FRS Section 14 (Error Catalogue)**. The backend error handling middleware MUST map thrown domain errors directly to these exact codes and HTTP statuses.

---

## 20. Validation Strategy

### 20.1 Three-Layer Validation

| Layer      | Responsibility                               | Technology     |
| ---------- | -------------------------------------------- | -------------- |
| Client     | Immediate feedback; UX-driven                | Zod (shared)   |
| Server     | Authoritative validation; security-critical  | Zod (shared)   |
| Database   | Constraints as final safety net              | Prisma + SQL   |

### 20.2 Validation Middleware

A reusable validation middleware SHALL accept a Zod schema and validate `req.body`, `req.query`, and `req.params`. On failure, it returns a 422 response with field-level errors in the standard error format.

```typescript
// Conceptual signature
function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}): RequestHandler;
```

---

## 21. State Management Strategy

### 21.1 State Categories

| State Type     | Tool           | Purpose                                                  |
| -------------- | -------------- | -------------------------------------------------------- |
| Server State   | TanStack Query | All data fetched from the API: notes, tags, search, etc. |
| Auth State     | Zustand        | Access token, refresh token, authenticated user info.    |
| UI State       | Zustand        | Sidebar open/close, active modal, editor dirty state.    |
| Form State     | React state    | Individual form inputs, controlled components.           |

### 21.2 TanStack Query Configuration

| Setting            | Value          | Rationale                                      |
| ------------------ | -------------- | ---------------------------------------------- |
| `staleTime`        | 30 seconds     | Reasonable freshness for single-user data      |
| `gcTime`           | 5 minutes      | Keep cache for quick navigation                |
| `retry`            | 3              | Retry failed requests (except 4xx)             |
| `refetchOnFocus`   | true           | Refetch when user returns to tab               |

### 21.3 Query Key Convention

All query keys SHALL follow a consistent hierarchy:

```typescript
// Examples
['notes', 'list', { page, pageSize, sortBy, sortOrder, tagIds }]
['notes', 'detail', noteId]
['notes', noteId, 'versions']
['notes', noteId, 'versions', versionNumber]
['tags', 'list']
['search', { q, page, pageSize, tagIds }]
['shares', 'list']
```

### 21.4 Zustand Store Design

```typescript
// Auth Store
interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

// UI Store
interface UIStore {
  sidebarOpen: boolean;
  activeModal: ModalType | null;
  editorDirty: boolean;
  toggleSidebar: () => void;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  setEditorDirty: (dirty: boolean) => void;
}
```

---

## 22. Data Fetching Strategy

### 22.1 API Client Architecture

```typescript
// Conceptual structure
class ApiClient {
  private baseUrl: string;
  private authStore: AuthStore;

  async request<T>(config: RequestConfig): Promise<T>;
  private async handleUnauthorized(config: RequestConfig): Promise<Response>;
  private getHeaders(): Headers;
}
```

### 22.2 Optimistic Updates

The following mutations SHALL use optimistic updates via TanStack Query:

| Mutation       | Optimistic Behavior                                           |
| -------------- | ------------------------------------------------------------- |
| Update note    | Immediately update note in list and detail caches             |
| Soft-delete    | Immediately remove note from list cache                       |
| Tag update     | Immediately update tag in list cache                          |
| Tag delete     | Immediately remove tag and update associated note caches      |

### 22.3 Cache Invalidation Strategy

| Mutation                   | Invalidated Query Keys                                |
| -------------------------- | ----------------------------------------------------- |
| Create note                | `['notes', 'list']`, `['tags', 'list']`               |
| Update note                | `['notes', 'detail', noteId]`, `['notes', 'list']`   |
| Delete note                | `['notes', 'list']`, `['tags', 'list']`               |
| Restore note               | `['notes', 'list']`, `['tags', 'list']`               |
| Create/update/delete tag   | `['tags', 'list']`, `['notes', 'list']`               |
| Generate share link        | `['notes', 'detail', noteId]`, `['shares', 'list']`  |
| Revoke share link          | `['notes', 'detail', noteId]`, `['shares', 'list']`  |
| Restore version            | `['notes', 'detail', noteId]`, `['notes', noteId, 'versions']` |

---

## 23. Rich Text Editor Architecture (TipTap)

### 23.1 Editor Configuration

TipTap SHALL be configured with the following extensions:

| Extension           | Purpose                          |
| ------------------- | -------------------------------- |
| StarterKit          | Base editor functionality        |
| Placeholder         | Empty editor placeholder text    |
| Typography          | Smart quotes and typography      |
| Highlight           | Text highlighting                |
| Link                | Hyperlinks                       |
| CodeBlockLowlight   | Syntax-highlighted code blocks   |
| TaskList / TaskItem | Interactive task lists           |
| Underline           | Underline formatting             |
| TextAlign           | Text alignment (left/center/right)|
| CharacterCount      | Character/word count display     |

### 23.2 Content Storage

| Format      | Column         | Purpose                                              |
| ----------- | -------------- | ---------------------------------------------------- |
| HTML        | `content`      | TipTap native output; rendered in editor and shared view |
| Plain Text  | `contentPlain` | Extracted from HTML; used for full-text search indexing   |

The backend SHALL extract plain text from HTML content before saving, using a server-side HTML-to-text utility. This plain text is used exclusively for search indexing.

### 23.3 Autosave Design

```mermaid
sequenceDiagram
    participant User
    participant Editor as TipTap Editor
    participant Debounce as Debounce Timer
    participant API as API Client

    User->>Editor: Type content
    Editor->>Debounce: Reset timer (2 seconds)
    User->>Editor: Type more content
    Editor->>Debounce: Reset timer (2 seconds)
    Note over Debounce: 2 seconds of inactivity
    Debounce->>API: PATCH /api/notes/:id
    API-->>Editor: Updated note
    Editor->>Editor: Mark as saved
```

**Autosave Rules:**
1. Debounce period: 2 seconds of inactivity.
2. Autosave triggers only when content has changed (dirty check).
3. A "Saving..." indicator SHALL be shown during the API call.
4. A "Saved" indicator SHALL be shown after successful save.
5. If autosave fails, the user SHALL see an error indicator and the unsaved content SHALL be preserved in memory.
6. Navigating away with unsaved changes SHALL trigger a browser confirmation dialog.

### 23.4 Content Sanitization

All HTML content from TipTap SHALL be sanitized on the server side before storage to prevent XSS attacks. A whitelist-based sanitizer SHALL be used, allowing only the HTML tags and attributes produced by the configured TipTap extensions.

**Allowed Tags:** `p`, `h1`–`h6`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `em`, `strong`, `u`, `s`, `a`, `br`, `mark`, `span`, `div`, `input` (checkbox only), `label`.

**Allowed Attributes:** `href` (on `a` tags, validated URL), `class`, `data-type`, `data-checked`, `style` (text-align only).

---

## 24. PostgreSQL Full-Text Search Design

### 24.1 Search Architecture

Full-text search SHALL use PostgreSQL's native `tsvector` and `tsquery` types with the following design:

```mermaid
graph LR
    Save["Note Save"] --> Extract["Extract Plain Text"]
    Extract --> Update["Update searchVector"]
    Update --> GIN["GIN Index"]
    
    Query["Search Query"] --> TSQuery["Parse to tsquery"]
    TSQuery --> Match["Match against GIN Index"]
    Match --> Rank["ts_rank Scoring"]
    Rank --> Highlight["ts_headline Snippets"]
    Highlight --> Results["Search Results"]
```

### 24.2 Search Vector Configuration

- **Language:** `english` (PostgreSQL dictionary)
- **Weighted Fields:**
  - Title: Weight `A` (highest priority)
  - Content (plain text): Weight `B`
- **Update Trigger:** A PostgreSQL trigger SHALL update `searchVector` whenever `title` or `contentPlain` is modified.

### 24.3 Search Vector SQL

```sql
-- Migration: Add search vector column and trigger
ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector;

CREATE INDEX idx_note_search_vector ON "Note" USING GIN("searchVector");

CREATE OR REPLACE FUNCTION note_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."contentPlain", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "contentPlain"
  ON "Note"
  FOR EACH ROW
  EXECUTE FUNCTION note_search_vector_update();
```

### 24.4 Search Query Execution

```sql
-- Example search query with ranking and highlighting
SELECT
  n."id",
  n."title",
  ts_rank(n."searchVector", query) AS "rank",
  ts_headline('english', n."contentPlain", query,
    'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
  ) AS "snippet"
FROM "Note" n,
  plainto_tsquery('english', $1) query
WHERE
  n."userId" = $2
  AND n."deletedAt" IS NULL
  AND n."searchVector" @@ query
ORDER BY "rank" DESC
LIMIT $3 OFFSET $4;
```

### 24.5 Search Features

| Feature              | Implementation                                        |
| -------------------- | ----------------------------------------------------- |
| Stemming             | Automatic via `english` dictionary (e.g., "running" → "run") |
| Prefix matching      | Supported via `to_tsquery` with `:*` suffix           |
| Ranking              | `ts_rank` with weighted vectors (title > content)     |
| Highlighting         | `ts_headline` wrapping matches in `<mark>` tags       |
| Stop words           | Automatic filtering via PostgreSQL dictionary          |

---

## 25. Sharing Architecture

### 25.1 Share Link Generation

1. Generate a UUID v4 as the share token.
2. Store the token, note ID, expiry timestamp, and initial view count (0) in the `ShareLink` table.
3. Return the full URL: `{FRONTEND_URL}/shared/{token}`.

### 25.2 Share Link Access

1. Look up the share token in the `ShareLink` table.
2. Validate the token has not expired (`expiresAt > NOW()`).
3. Validate the associated note is not soft-deleted.
4. Atomically increment the view count using `UPDATE ... SET "viewCount" = "viewCount" + 1`.
5. Return the note content in a read-only format (no edit controls, no tags, no version history, no author email).

### 25.3 Atomic View Count

View count increment SHALL use an atomic database operation to prevent race conditions under concurrent access:

```sql
UPDATE "ShareLink"
SET "viewCount" = "viewCount" + 1
WHERE "token" = $1
  AND "expiresAt" > NOW()
RETURNING *;
```

### 25.4 Share Link Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active : Generate link
    Active --> Expired : expiresAt reached
    Active --> Revoked : Owner revokes
    Active --> Revoked : Note soft-deleted
    Expired --> [*]
    Revoked --> [*]
```

---

## 26. Version History Design

### 26.1 Version Creation

Every call to create or update a note SHALL create a version snapshot:

1. Determine the next version number: `MAX(versionNumber) + 1` for the note (or 1 for new notes).
2. Insert a `NoteVersion` record with the current title, content, and version number.
3. This operation occurs within the same database transaction as the note save.

### 26.2 Version Numbering

- Version numbers are sequential integers, starting at 1.
- Each note has its own independent version sequence.
- Version numbers never reset or recycle.

### 26.3 Version Restore

Restoring a version does NOT roll back history. Instead:

1. Read the target version's title and content.
2. Update the current note with the version's title and content.
3. Create a new version snapshot (next version number) capturing the restored state.
4. The restored version's original version number remains unchanged.

### 26.4 Auto-Purge Strategy

A background process (scheduled or triggered) SHALL:

1. For each note, find all versions older than 90 days.
2. From those, exclude the 10 most recent versions (regardless of age).
3. Delete the remaining eligible versions.
4. This process SHALL run with low priority to minimize database load.

---

## 27. Soft Delete Strategy

### 27.1 Implementation

Soft delete is implemented by setting the `deletedAt` column to the current timestamp. The row is never physically deleted within the 30-day recovery window.

### 27.2 Query Scoping

All standard note queries SHALL include `WHERE "deletedAt" IS NULL` to exclude soft-deleted notes. Specific endpoints (trash view, restore) explicitly query for soft-deleted notes.

### 27.3 Side Effects of Soft Delete

When a note is soft-deleted:

1. The `deletedAt` timestamp is set.
2. Any active `ShareLink` for the note is hard-deleted.
3. Tag associations remain intact (preserved for restore).
4. Version history remains intact (preserved for restore).

### 27.4 Restore

Restoring a soft-deleted note:

1. Sets `deletedAt` to NULL.
2. Tag associations are still present (they were never removed).
3. Version history is still present.
4. No new share link is created (user must regenerate if needed).

### 27.5 Permanent Purge

Notes that have been soft-deleted for more than 30 days MAY be permanently purged by a background process. This purge:

1. Deletes the note row (cascade deletes NoteTag, NoteVersion, and ShareLink records).
2. Is irreversible.
3. Runs with low priority to minimize database load.

---

## 28. Security Design

### 28.1 Defense in Depth

```mermaid
graph TB
    subgraph Client["Client-Side"]
        HTTPS["HTTPS Only"]
        InputVal["Input Validation (Zod)"]
        TokenMem["Tokens in Memory"]
    end

    subgraph Network["Network"]
        CORS["CORS Whitelist"]
        RateLimit["Rate Limiting"]
        Headers["Security Headers"]
    end

    subgraph Server["Server-Side"]
        AuthMW["Auth Middleware (JWT)"]
        ServerVal["Server Validation (Zod)"]
        Sanitize["HTML Sanitization"]
        ScopeQ["User-Scoped Queries"]
    end

    subgraph Database["Database"]
        Encrypt["Hashed Passwords"]
        Constraints["DB Constraints"]
        Parameterized["Parameterized Queries"]
    end

    Client --> Network --> Server --> Database
```

### 28.2 Security Measures by Layer

| Layer     | Measure                           | Description                                                |
| --------- | --------------------------------- | ---------------------------------------------------------- |
| Transport | HTTPS                             | All communications encrypted in transit                    |
| Network   | CORS                              | Only frontend origin allowed                               |
| Network   | Rate Limiting                     | Per-IP and per-user rate limits on auth endpoints           |
| Network   | Security Headers                  | Helmet.js sets CSP, HSTS, X-Frame-Options, etc.           |
| Auth      | JWT Verification                  | Access tokens verified on every authenticated request      |
| Auth      | Token Rotation                    | Refresh tokens invalidated after single use                |
| Auth      | Bcrypt Hashing                    | Passwords hashed with cost factor ≥12                      |
| Auth      | OTP Hashing                       | OTPs hashed with SHA-256 before storage                    |
| Input     | Zod Validation                    | All inputs validated against strict schemas                |
| Input     | HTML Sanitization                 | Whitelist-based sanitization of rich-text content           |
| Query     | User Scoping                      | All queries include userId filter                          |
| Query     | Prisma Parameterization           | All queries parameterized (no SQL injection)               |
| Response  | Error Sanitization                | No internal details in error responses                     |
| Response  | 404 over 403                      | Unauthorized access returns 404 to prevent enumeration     |

### 28.3 Rate Limiting Configuration

| Endpoint Category        | Limit                   | Window  |
| ------------------------ | ----------------------- | ------- |
| Login                    | 5 attempts              | 15 min  |
| Registration             | 3 attempts              | 1 hour  |
| OTP Request              | 3 attempts per email    | 1 hour  |
| OTP Verification         | 5 attempts per email    | 1 hour  |
| Password Reset           | 3 attempts              | 1 hour  |
| General API              | 100 requests            | 1 min   |
| Search                   | 30 requests             | 1 min   |

---

## 29. Logging Strategy

### 29.1 Logging Format

All logs SHALL use structured JSON format:

```json
{
  "timestamp": "2026-07-21T12:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "correlationId": "uuid",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200,
  "responseTime": 45,
  "userId": "uuid-or-null"
}
```

### 29.2 Log Levels

| Level  | Usage                                                        |
| ------ | ------------------------------------------------------------ |
| `error`| Unexpected failures, unhandled exceptions                    |
| `warn` | Recoverable issues, rate limit hits, auth failures           |
| `info` | Request/response lifecycle, business events                  |
| `debug`| Detailed debugging (disabled in production)                  |

### 29.3 Sensitive Data Protection

The following SHALL NEVER appear in logs:

- Passwords (plain text or hashed)
- JWT access tokens or refresh tokens
- OTP values
- Password reset tokens
- Note content (user private data)
- Full email addresses (log masked version: `j***@example.com`)

### 29.4 Simulated Email Logging

Simulated emails (OTP, verification) SHALL be logged in a clearly formatted block:

```
══════════════════════════════════════════
📧 SIMULATED EMAIL
To: user@example.com
Subject: Password Reset OTP
Body: Your OTP is: 123456. Expires in 10 minutes.
══════════════════════════════════════════
```

---

## 30. Testing Strategy

### 30.1 Testing Pyramid

```mermaid
graph TB
    E2E["E2E Tests (Playwright)"] --> Integration["Integration Tests (Supertest)"]
    Integration --> Unit["Unit Tests (Vitest)"]
    
    style E2E fill:#ff6b6b,color:#fff
    style Integration fill:#ffa94d,color:#fff
    style Unit fill:#51cf66,color:#fff
```

### 30.2 Testing Breakdown

| Test Type     | Framework         | Scope                                         | Location                        |
| ------------- | ----------------- | --------------------------------------------- | ------------------------------- |
| Unit          | Vitest            | Services, utilities, validation schemas       | `*/tests/unit/`                 |
| Integration   | Vitest + Supertest| API endpoints with real database              | `backend/tests/integration/`    |
| E2E           | Playwright        | Full user journeys through the browser        | `frontend/tests/e2e/`           |

### 30.3 Test Database Strategy

- Integration tests SHALL use a separate PostgreSQL database (e.g., `notetaking_test`).
- The test database SHALL be reset (migrations re-run) before each test suite.
- Each test SHALL run in a transaction that is rolled back after completion (for speed).
- Test fixtures SHALL be created using factory functions, not raw SQL.

### 30.4 Coverage Requirements

| Metric          | Minimum   |
| --------------- | --------- |
| Line coverage   | 80%       |
| Branch coverage | 80%       |
| Function coverage| 80%      |

Coverage is enforced on new code. Coverage reports SHALL be generated with `pnpm test --coverage`.

### 30.5 Test Naming Convention

Each spec scenario SHALL have exactly one named test:

```typescript
// Pattern: describe > it "scenario name from spec"
describe('POST /api/auth/register', () => {
  it('should register a new user with valid data', async () => { ... });
  it('should return 409 when email already exists', async () => { ... });
  it('should return 422 when password is too weak', async () => { ... });
});
```

---

## 31. Build & Deployment Strategy

### 31.1 Build Pipeline

```mermaid
graph LR
    Install["pnpm install"] --> Build["pnpm build"]
    Build --> Lint["pnpm lint"]
    Lint --> Test["pnpm test"]
    Test --> Ready["Deploy Ready"]
```

### 31.2 Build Commands

| Command              | Description                                   |
| -------------------- | --------------------------------------------- |
| `pnpm install`       | Install all dependencies across workspaces    |
| `pnpm build`         | Build all packages (shared → backend → frontend) |
| `pnpm lint`          | Run ESLint across all packages                |
| `pnpm test`          | Run Vitest tests across all packages          |
| `pnpm test --coverage` | Run tests with coverage report             |
| `pnpm dev`           | Start backend and frontend dev servers        |
| `pnpm dev:backend`   | Start backend dev server only                 |
| `pnpm dev:frontend`  | Start frontend dev server only                |
| `pnpm db:migrate`    | Run Prisma migrations                         |
| `pnpm db:generate`   | Generate Prisma client                        |
| `pnpm db:seed`       | Seed database with test data                  |

### 31.3 Build Order

The monorepo MUST build in dependency order:

1. `packages/shared` (no dependencies)
2. `backend` (depends on `shared`)
3. `frontend` (depends on `shared`)

### 31.4 Quality Gates

After every phase checkpoint during development:

1. `pnpm build` → 0 errors, 0 warnings
2. `pnpm lint --max-warnings 0` → clean
3. `pnpm test` → all green

Before every commit:

1. Husky pre-commit hook runs lint and tests.
2. `commitlint` validates commit message format.
3. TypeScript type-checking passes.

---

## 32. Coding Standards

### 32.1 TypeScript Standards

| Rule                              | Standard                                             |
| --------------------------------- | ---------------------------------------------------- |
| Strict mode                       | `"strict": true` in `tsconfig.json`                  |
| No `any`                          | `"noImplicitAny": true`; explicit typing required    |
| Null safety                       | `"strictNullChecks": true`                           |
| Unused variables                  | `"noUnusedLocals": true`, `"noUnusedParameters": true` |
| Return types                      | Explicit return types on all exported functions       |
| Enums                             | Use `const` enums or string unions over numeric enums|

### 32.2 Naming Conventions

| Element            | Convention       | Example                        |
| ------------------ | ---------------- | ------------------------------ |
| Files              | kebab-case       | `notes.service.ts`             |
| Classes            | PascalCase       | `NotesService`                 |
| Interfaces         | PascalCase       | `CreateNoteRequest`            |
| Functions          | camelCase        | `createNote`                   |
| Variables          | camelCase        | `noteContent`                  |
| Constants          | UPPER_SNAKE_CASE | `MAX_TITLE_LENGTH`             |
| React Components   | PascalCase       | `NoteEditor`                   |
| React Hooks        | camelCase (use*) | `useNotes`                     |
| CSS Classes        | kebab-case       | `note-editor`                  |

### 32.3 Error Handling

- All async functions MUST use try/catch or `.catch()`.
- Service methods MUST throw typed domain errors (not generic `Error`).
- Controllers MUST NOT catch errors; the global error handler processes them.
- The global error handler maps domain errors to HTTP status codes and standard error format.

### 32.4 Commit Message Format

```
type(scope): description AB#ticket

type:  feat | fix | chore | refactor | test | docs
scope: auth | notes | tags | search | share | versions | shared | config
```

Examples:
```
feat(auth): implement user registration AB#1002
fix(notes): return 404 for soft-deleted notes AB#1004
chore(config): add ESLint configuration AB#1001
```

---

## 33. Performance Considerations

| Area              | Strategy                                                           |
| ----------------- | ------------------------------------------------------------------ |
| Database Queries  | Use indexes for all frequently queried columns; avoid N+1 queries  |
| Full-Text Search  | GIN index on `searchVector`; limit result sets                     |
| API Responses     | Return only necessary fields; paginate all list endpoints          |
| Frontend Bundle   | Code splitting per route; lazy loading for editor                  |
| Autosave          | Debounced at 2 seconds to prevent excessive API calls              |
| Token Refresh     | Single concurrent refresh; queue other requests                    |
| Image-Free        | No file uploads; minimal static assets                             |
| Database Connections | Connection pooling via Prisma                                    |

---

## 34. Scalability Considerations

| Area              | Current Design                  | Future Scaling Path                      |
| ----------------- | ------------------------------- | ---------------------------------------- |
| Database          | Single PostgreSQL instance      | Read replicas, connection pooling        |
| Search            | PostgreSQL FTS                  | Elasticsearch/Meilisearch migration      |
| Sessions          | DB-stored refresh tokens        | Redis-backed session store               |
| Caching           | TanStack Query client cache     | Server-side Redis cache for hot data     |
| Background Jobs   | In-process scheduled functions  | Dedicated job queue (BullMQ, pg-boss)    |
| File Storage      | Out of scope                    | Object storage (S3/GCS)                  |
| Rate Limiting     | In-memory (per-process)         | Redis-backed distributed rate limiting   |

---

## 35. Future Enhancements

These items are documented for future consideration and are NOT in the current scope:

| Enhancement                   | Priority | Dependencies                              |
| ----------------------------- | -------- | ----------------------------------------- |
| OAuth / Social Login          | Medium   | OAuth provider integration                |
| Real-time Collaboration       | High     | WebSocket infrastructure, OT/CRDT         |
| File Attachments              | Medium   | Object storage, upload service            |
| Note Folders / Hierarchy      | Low      | Schema migration, UI redesign             |
| Mobile Application            | Medium   | React Native or native development        |
| Export to PDF/Markdown         | Low      | PDF generation library                    |
| Notification System           | Medium   | Push notification infrastructure          |
| Admin Dashboard               | Low      | Admin role, management UI                 |
| Internationalization (i18n)   | Medium   | Translation framework                    |
| Advanced Search (filters)     | Medium   | Extended query syntax                     |
---

## 36. Docker & Database Setup

### 36.1 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: notetaking-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: notetaking
      POSTGRES_PASSWORD: notetaking_dev
      POSTGRES_DB: notetaking
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notetaking"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 36.2 Test Database Initialization

```sql
-- scripts/init-test-db.sql
CREATE DATABASE notetaking_test;
GRANT ALL PRIVILEGES ON DATABASE notetaking_test TO notetaking;
```

### 36.3 Environment Files

```bash
# .env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://notetaking:notetaking_dev@localhost:5432/notetaking
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
BCRYPT_ROUNDS=12
OTP_EXPIRY_MINUTES=10
RESET_TOKEN_EXPIRY_MIN=15
SHARE_DEFAULT_EXPIRY_HRS=168
VERSION_PURGE_DAYS=90
VERSION_MIN_RETAIN=10
LOG_LEVEL=info
```

```bash
# .env.test
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://notetaking:notetaking_dev@localhost:5432/notetaking_test
JWT_SECRET=test-secret-key-at-least-32-characters
CORS_ORIGIN=http://localhost:5173
BCRYPT_ROUNDS=4
LOG_LEVEL=error
```

---

## 37. Developer Tooling Configuration

### 37.1 pnpm Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 37.2 Root package.json Scripts

```json
{
  "name": "note-taking-app",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "build:shared": "pnpm --filter @note-app/shared build",
    "build:backend": "pnpm --filter @note-app/backend build",
    "build:frontend": "pnpm --filter @note-app/frontend build",
    "dev": "pnpm run --parallel dev:backend dev:frontend",
    "dev:backend": "pnpm --filter @note-app/backend dev",
    "dev:frontend": "pnpm --filter @note-app/frontend dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:coverage": "pnpm -r test -- --coverage",
    "test:e2e": "pnpm --filter @note-app/frontend test:e2e",
    "db:migrate": "pnpm --filter @note-app/backend prisma migrate dev",
    "db:generate": "pnpm --filter @note-app/backend prisma generate",
    "db:seed": "pnpm --filter @note-app/backend prisma db seed",
    "db:reset": "pnpm --filter @note-app/backend prisma migrate reset",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "9.1.7",
    "@commitlint/cli": "19.8.0",
    "@commitlint/config-conventional": "19.8.0"
  }
}
```

### 37.3 TypeScript Base Configuration

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 37.4 ESLint Configuration

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
};
```

### 37.5 Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf",
  "arrowParens": "always"
}
```

### 37.6 Commitlint Configuration

```javascript
// commitlint.config.cjs
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'refactor', 'test', 'docs', 'style', 'perf', 'ci',
    ]],
    'scope-enum': [2, 'always', [
      'auth', 'notes', 'tags', 'search', 'share', 'versions', 'shared', 'config', 'deps',
    ]],
    'subject-max-length': [2, 'always', 100],
  },
};
```

### 37.7 Husky Hooks

```bash
# .husky/pre-commit
pnpm lint --max-warnings 0
pnpm -r exec tsc --noEmit
```

```bash
# .husky/commit-msg
pnpm commitlint --edit $1
```

### 37.8 Vitest Configuration (Backend)

```typescript
// apps/backend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
      },
      exclude: ['tests/', 'prisma/', 'dist/', 'node_modules/'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### 37.9 Vitest Configuration (Frontend)

```typescript
// apps/frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
      },
      exclude: ['tests/', 'dist/', 'node_modules/'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### 37.10 Playwright Configuration

```typescript
// apps/frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:backend',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
    },
    {
      command: 'pnpm dev:frontend',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
    },
  ],
});
```

### 37.11 .gitignore

```
# Dependencies
node_modules/

# Build outputs
dist/
build/

# Environment files
.env
.env.local
.env.*.local
!.env.example
!.env.test

# Prisma
apps/backend/prisma/migrations/*.sql.bak

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
test-results/
playwright-report/

# Logs
*.log

# Generated
apps/backend/node_modules/.prisma/
```

---

## 38. AI Development Infrastructure

### 38.1 CLAUDE.md Structure

The project SHALL have multiple `CLAUDE.md` files providing context at different scopes:

#### 38.1.1 Root CLAUDE.md

```markdown
# CLAUDE.md — Note Taking App

## Project Overview
Full-stack Note Taking Application (React + Express + PostgreSQL).
Monorepo with pnpm workspaces.

## Quality Gates (MANDATORY before every commit)
1. `pnpm build` — zero errors, zero warnings
2. `pnpm lint --max-warnings 0` — clean
3. `pnpm test` — all green, ≥80% coverage on new code

## Commit Format
`type(scope): description AB#ticket`
Types: feat | fix | chore | refactor | test | docs
Scopes: auth | notes | tags | search | share | versions | shared | config

## Key Architecture Rules
- Shared types/schemas ONLY in `packages/shared` — NEVER duplicate.
- Backend layers: Router → Validation → Controller → Service → Prisma.
- Frontend state: TanStack Query (server) + Zustand (auth/UI).
- Soft delete = set `deletedAt` timestamp, NEVER hard delete notes.
- All queries MUST include `WHERE userId = <authUserId>`.
- Access to another user's resource MUST return 404, not 403.

## Database
- PostgreSQL 16 via Docker: `docker compose up -d`
- Migrations: `pnpm db:migrate`
- Client gen: `pnpm db:generate`

## Development
- Backend: `pnpm dev:backend` (port 3000)
- Frontend: `pnpm dev:frontend` (port 5173)
- Full: `pnpm dev`
```

#### 38.1.2 Backend CLAUDE.md (`apps/backend/CLAUDE.md`)

```markdown
# Backend CLAUDE.md

## Module Structure
Each feature module in `src/modules/<name>/` has:
- `<name>.router.ts` — Route definitions
- `<name>.controller.ts` — HTTP request handling
- `<name>.service.ts` — Business logic
- `<name>.errors.ts` — Domain error classes

## Rules
- Controllers MUST NOT contain business logic.
- Services MUST NOT access req/res objects.
- All errors thrown from services are caught by global error handler.
- No raw SQL except full-text search queries.
- Every endpoint must have integration tests.

## Testing
- Unit tests: `tests/unit/` — test services in isolation.
- Integration tests: `tests/integration/` — test endpoints with Supertest against test DB.
- Run: `pnpm test`
```

#### 38.1.3 Frontend CLAUDE.md (`apps/frontend/CLAUDE.md`)

```markdown
# Frontend CLAUDE.md

## Architecture
- Feature-based: `src/features/<name>/` for each domain.
- Pages in `src/pages/` compose features.
- Shared UI in `src/components/ui/` (shadcn/ui).
- All API calls go through `src/lib/api-client.ts`.

## Rules
- ALL types imported from `@note-app/shared` — never define locally.
- Use TanStack Query for ALL server data fetching.
- Use Zustand ONLY for auth state and UI state.
- Use React state for form inputs.
- Every component must have accessible labels and keyboard support.

## Testing
- Unit tests: `tests/unit/` — test components and hooks.
- E2E tests: `tests/e2e/` — Playwright full journey tests.
```

### 38.2 AGENTS.md Structure

```markdown
# AGENTS.md — Note Taking App

## Project Context
This is a full-stack Note Taking Application following SDD workflow.
Docs: `docs/FRS.md`, `docs/SDS.md`, `docs/UX.md`

## Specs & Workflow
- Ticket prefix: `AB-10XX`
- SDD cycle: spec → plan → tasks → implement → review → PR
- Every ticket MUST have an openspec proposal before implementation.

## Key Constraints
- No features beyond what's in FRS scope.
- No technology substitutions (CON-001 through CON-010).
- All emails are console-logged, never actually sent.
- Soft delete only — never hard delete notes within 30-day window.
```

### 38.3 Slash Commands

Seven slash commands SHALL be created in `.claude/commands/`:

| Command | File | Purpose |
| ------- | ---- | ------- |
| `/start` | `start.md` | Begin a new ticket. Reads ticket scope from FRS Section 25.3, sets context. |
| `/spec` | `spec.md` | Generate a spec proposal for the current ticket using OpenSpec. Reads FRS, SDS, UX. |
| `/plan` | `plan.md` | Create an implementation plan with ordered file changes. |
| `/tasks` | `tasks.md` | Break the plan into atomic tasks with checkboxes. |
| `/implement` | `implement.md` | Implement the next unchecked task. Run quality gates after each. |
| `/review` | `review.md` | Self-review against spec scenarios. Run all tests. Check coverage. |
| `/pr` | `pr.md` | Generate PR description listing FRS requirements covered and spec scenarios tested. |

### 38.4 Sub-Agents

Two sub-agents SHALL be created in `.claude/agents/`:

| Agent | File | Purpose |
| ----- | ---- | ------- |
| Reviewer | `reviewer.md` | Reviews implementation against spec. Checks error handling, edge cases, security. |
| Test Writer | `test-writer.md` | Generates unit, integration, or E2E tests from spec scenarios. |

### 38.5 OpenSpec

OpenSpec SHALL be initialized with:

```
openspec/
├── project.md              # Project context (from FRS Sections 2-4)
├── tickets/                # Per-ticket spec proposals
│   ├── AB-1001.md
│   ├── AB-1002.md
│   └── ...
└── archive/                # Completed ticket specs
```

---

## 39. Future Enhancements

These items are documented for future consideration and are NOT in the current scope:

| Enhancement                   | Priority | Dependencies                              |
| ----------------------------- | -------- | ----------------------------------------- |
| OAuth / Social Login          | Medium   | OAuth provider integration                |
| Real-time Collaboration       | High     | WebSocket infrastructure, OT/CRDT         |
| File Attachments              | Medium   | Object storage, upload service            |
| Note Folders / Hierarchy      | Low      | Schema migration, UI redesign             |
| Mobile Application            | Medium   | React Native or native development        |
| Export to PDF/Markdown         | Low      | PDF generation library                    |
| Notification System           | Medium   | Push notification infrastructure          |
| Admin Dashboard               | Low      | Admin role, management UI                 |
| Internationalization (i18n)   | Medium   | Translation framework                    |
| Advanced Search (filters)     | Medium   | Extended query syntax                     |

---

*End of Software Design Specification*
