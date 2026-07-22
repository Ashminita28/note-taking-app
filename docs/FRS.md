# Functional Requirements Specification (FRS)

## Note Taking Application

---

## 1. Document Information

| Field               | Value                                      |
| ------------------- | ------------------------------------------ |
| Document Title      | Functional Requirements Specification      |
| Project Name        | Note Taking Application                    |
| Version             | 1.0.0                                      |
| Status              | Draft                                   |
| Created Date        | 2026-07-21                                 |
| Last Updated        | 2026-07-21                                 |                                |
| Related Documents   | SDS.md, UX.md                              |


### 1.1 Document Conventions

| Term     | Meaning                                                    |
| -------- | ---------------------------------------------------------- |
| SHALL    | Mandatory requirement; must be implemented                 |
| MUST     | Same as SHALL; non-negotiable                              |
| SHOULD   | Recommended; implement unless justification exists         |
| MAY      | Optional; implement at discretion                          |
| SHALL NOT| Explicitly prohibited                                      |

---

## 2. Introduction

This Functional Requirements Specification (FRS) defines the complete set of functional and non-functional requirements for the Note Taking Application. The application is a full-stack web platform that enables authenticated users to create, organize, search, and share rich-text notes. This document serves as the authoritative source of truth for **what** the system must do and is intended to be consumed by developers, testers, designers, and project managers throughout the development lifecycle.

All implementation decisions, API contracts, and architectural patterns are documented separately in the Software Design Specification (SDS.md). User experience flows, screen layouts, and interaction patterns are documented in the User Experience Specification (UX.md).

### 2.1 Cross-Document Traceability

This document establishes stable **Requirement IDs** that are referenced throughout the specification suite:

| Document | Cross-Reference Usage                                                |
| -------- | -------------------------------------------------------------------- |
| SDS.md   | Each API endpoint group and database entity references its related Requirement IDs. |
| UX.md    | Each screen specification and user flow references its related Requirement IDs. |

---

## 3. Purpose

The purpose of this document is to:

1. Define every functional requirement the system must satisfy.
2. Establish traceable requirement IDs for use in tickets, specs, tests, and code reviews.
3. Document business rules, validation rules, and error scenarios exhaustively.
4. Specify non-functional requirements including security, performance, accessibility, and browser support.
5. Serve as the contract between stakeholders and the development team.
6. Provide acceptance criteria that determine whether each requirement is met.

---

## 4. Scope

### 4.1 In Scope

The Note Taking Application SHALL provide the following capabilities:

1. **User Authentication** — Registration, login, logout, and password reset via one-time password (OTP).
2. **Notes Management** — Full CRUD operations on rich-text notes with soft delete and 30-day recovery.
3. **Tagging System** — User-scoped tags with color support, assignment to notes, and per-tag note counts.
4. **Full-Text Search** — PostgreSQL-powered full-text search with keyword highlighting in results.
5. **Note Sharing** — Generation and revocation of public read-only links with configurable expiry and atomic view counting.
6. **Version History** — Automatic snapshots on every save, with the ability to view any historical version and restore it as a new version.

### 4.2 Out of Scope

The following items are explicitly excluded. Any attempt to implement them is a violation:

| Item                              | Reason                                      |
| --------------------------------- | ------------------------------------------- |
| Real-time collaborative editing   | Not required for MVP                        |
| File or image attachments         | Excluded from scope                         |
| Mobile application (native)       | Web-only; responsive design covers mobile   |
| OAuth / social login              | JWT-based auth only                         |
| Note folders or nesting           | Flat tag-based organization only            |
| Actual email sending              | All emails SHALL be logged to console only  |

---

## 5. Business Goals

| ID     | Goal                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| BG-01  | Provide a fast, intuitive note-taking experience that encourages daily use                   |
| BG-02  | Enable users to organize and retrieve notes efficiently through tags and full-text search     |
| BG-03  | Allow controlled sharing of notes via time-limited public links                              |
| BG-04  | Protect user data through proper authentication, authorization, and soft-delete policies     |
| BG-05  | Maintain a complete revision history so users never lose previous versions of their work     |
| BG-06  | Deliver a production-quality codebase built through disciplined specification-driven workflow |

---

## 6. Stakeholders

| Role              | Responsibility                                                        |
| ----------------- | --------------------------------------------------------------------- |
| Product Manager   | Defines requirements, prioritizes features, accepts deliverables      |
| Team Lead         | Reviews architecture decisions, enforces workflow, approves PRs       |
| Backend Developer | Implements API, database, authentication, and business logic          |
| Frontend Developer| Implements UI, state management, rich-text editor, and user flows     |
| QA Engineer       | Writes and executes test plans, validates acceptance criteria         |
| End User          | Uses the application to create, organize, search, and share notes    |

---

## 7. User Roles

The system SHALL support the following user roles:

| Role                | Description                                                                                 | Authentication Required |
| ------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| Anonymous User      | Can view publicly shared notes via share links. Cannot create, edit, or manage any content. | No                      |
| Authenticated User  | Can perform all note operations: create, edit, delete, tag, search, share, view history.    | Yes                     |

### 7.1 Role Permissions Matrix

| Action                        | Anonymous User | Authenticated User |
| ----------------------------- | -------------- | ------------------ |
| View public shared note       | ✅              | ✅                  |
| Register                      | ✅              | N/A                |
| Login                         | ✅              | N/A                |
| Request password reset        | ✅              | N/A                |
| Create note                   | ❌              | ✅                  |
| Read own notes                | ❌              | ✅                  |
| Update own notes              | ❌              | ✅                  |
| Soft-delete own notes         | ❌              | ✅                  |
| Restore soft-deleted notes    | ❌              | ✅                  |
| Manage tags                   | ❌              | ✅                  |
| Search notes                  | ❌              | ✅                  |
| Generate share link           | ❌              | ✅                  |
| Revoke share link             | ❌              | ✅                  |
| View version history          | ❌              | ✅                  |
| Restore a version             | ❌              | ✅                  |
| Access another user's notes   | ❌              | ❌                  |

---

## 8. System Overview

The Note Taking Application is a web-based platform structured as a monorepo with three primary packages:

1. **Frontend** — A single-page application (SPA) providing the user interface.
2. **Backend** — A RESTful API server handling authentication, business logic, and data persistence.
3. **Shared** — A package containing TypeScript types, Zod validation schemas, and utility functions consumed by both frontend and backend.

Users interact with the system exclusively through a web browser. The backend communicates with a PostgreSQL database for data storage, full-text search indexing, and session management.

---

## 9. Functional Requirements

### 9.1 Authentication

#### FR-AUTH-001: User Registration

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-AUTH-001                                                                                 |
| **Description**   | The system SHALL allow new users to register with an email address and password.            |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1002                                                                                     |

**Preconditions:**
- User is not authenticated.
- User has a valid email address.

**Main Flow:**
1. User navigates to the registration page.
2. User enters their full name, email address, and password.
3. User submits the registration form.
4. System validates all input fields.
5. System checks that the email is not already registered.
6. System hashes the password using bcrypt with a minimum cost factor of 12.
7. System creates the user record in the database.
8. System returns a success response with the user ID.
9. System logs a verification email to the console (no actual email sent).

**Alternate Flows:**
- AF-1: If the user navigates away before submitting, no record is created.

**Error Cases:**
- EC-1: Email already registered → 409 Conflict with error code `EMAIL_ALREADY_EXISTS`.
- EC-2: Invalid email format → 422 Unprocessable Entity with field-level error.
- EC-3: Password does not meet complexity requirements → 422 Unprocessable Entity with field-level error.
- EC-4: Missing required fields → 422 Unprocessable Entity with field-level errors.
- EC-5: Server error during registration → 500 Internal Server Error.

**Acceptance Criteria:**
1. A new user can register with a valid name, email, and password.
2. Duplicate email registration returns 409.
3. Password is stored as a bcrypt hash, never in plain text.
4. Registration response includes the created user's ID.
5. A simulated verification email is logged to the console.
6. All validation errors return 422 with field-level details.

**Related APIs:**
- `POST /api/auth/register`

**Related Screens:**
- UX-SCR-001: Register

---

#### FR-AUTH-002: User Login

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-AUTH-002                                                                                 |
| **Description**   | The system SHALL allow registered users to log in with email and password, receiving a JWT access token and a refresh token. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1002                                                                                     |

**Preconditions:**
- User has a registered account.
- User is not currently authenticated (or existing session is irrelevant).

**Main Flow:**
1. User enters email and password on the login page.
2. System validates input fields.
3. System retrieves the user record by email.
4. System compares the provided password against the stored bcrypt hash.
5. System generates a JWT access token (15-minute expiry).
6. System generates a refresh token (7-day expiry) and stores it in the database.
7. System returns the access token, refresh token, and user profile.

**Alternate Flows:**
- AF-1: User is already logged in and attempts to log in again — system issues new tokens, invalidating the previous refresh token.

**Error Cases:**
- EC-1: Email not found → 401 Unauthorized with error code `INVALID_CREDENTIALS` (generic message to prevent email enumeration).
- EC-2: Incorrect password → 401 Unauthorized with error code `INVALID_CREDENTIALS`.
- EC-3: Missing required fields → 422 Unprocessable Entity with field-level errors.
- EC-4: Server error → 500 Internal Server Error.

**Acceptance Criteria:**
1. Valid credentials return a JWT access token, refresh token, and user profile.
2. Access token expires in exactly 15 minutes.
3. Refresh token expires in exactly 7 days and is stored in the database.
4. Invalid credentials return 401 without revealing whether email or password was wrong.
5. All validation errors return 422 with field-level details.

**Related APIs:**
- `POST /api/auth/login`

**Related Screens:**
- UX-SCR-002: Login

---

#### FR-AUTH-003: Token Refresh

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-AUTH-003                                                                                 |
| **Description**   | The system SHALL allow clients to exchange a valid refresh token for a new access token and a new refresh token (token rotation). |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1002                                                                                     |

**Preconditions:**
- Client possesses a valid, non-expired refresh token.

**Main Flow:**
1. Client sends the refresh token to the refresh endpoint.
2. System validates the refresh token exists in the database and has not expired.
3. System invalidates (deletes) the used refresh token.
4. System generates a new JWT access token (15-minute expiry).
5. System generates a new refresh token (7-day expiry) and stores it.
6. System returns the new access token and new refresh token.

**Error Cases:**
- EC-1: Refresh token not found in database → 401 Unauthorized with error code `INVALID_REFRESH_TOKEN`.
- EC-2: Refresh token has expired → 401 Unauthorized with error code `REFRESH_TOKEN_EXPIRED`.
- EC-3: Missing refresh token in request → 422 Unprocessable Entity.

**Acceptance Criteria:**
1. A valid refresh token returns new access and refresh tokens.
2. The old refresh token is invalidated immediately after use (rotation).
3. An expired refresh token returns 401.
4. A reused (already invalidated) refresh token returns 401.

**Related APIs:**
- `POST /api/auth/refresh`

**Related Screens:**
- N/A (background process triggered by the API client)

---

#### FR-AUTH-004: User Logout

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-AUTH-004                                                                                 |
| **Description**   | The system SHALL allow authenticated users to log out, invalidating their refresh token.    |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1002                                                                                     |

**Preconditions:**
- User is authenticated with a valid access token.

**Main Flow:**
1. Client sends a logout request with the refresh token.
2. System deletes the refresh token from the database.
3. System returns a success response.

**Alternate Flows:**
- AF-1: If the refresh token is already invalidated, the system still returns success (idempotent).

**Error Cases:**
- EC-1: No access token provided → 401 Unauthorized.
- EC-2: Invalid access token → 401 Unauthorized.

**Acceptance Criteria:**
1. After logout, the refresh token is no longer valid for token refresh.
2. Logout is idempotent — calling it twice with the same token does not error.
3. The access token naturally expires after 15 minutes; the server does not maintain a blocklist.

**Related APIs:**
- `POST /api/auth/logout`

**Related Screens:**
- UX-SCR-006: Dashboard (user menu → Sign out)

---

### 9.2 Password Reset (OTP)

#### FR-PWD-001: Request Password Reset

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-PWD-001                                                                                 |
| **Description**   | The system SHALL allow users to request a password reset by providing their email address. The system generates a 6-digit OTP and logs it to the console. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1003                                                                                     |

**Preconditions:**
- None (user may or may not be authenticated).

**Main Flow:**
1. User enters their email address on the forgot password page.
2. System validates the email format.
3. System checks if a user with this email exists.
4. System generates a cryptographically random 6-digit OTP.
5. System stores the OTP hash in the database with a 10-minute expiry timestamp.
6. System logs the OTP to the console (simulating email delivery).
7. System returns a generic success message regardless of whether the email exists.

**Alternate Flows:**
- AF-1: Email does not exist in the system — system still returns success to prevent email enumeration.
- AF-2: User requests a new OTP before the previous one expires — the previous OTP is invalidated and a new one is generated.

**Error Cases:**
- EC-1: Invalid email format → 422 Unprocessable Entity.
- EC-2: Rate limit exceeded (more than 3 requests per email per hour) → 429 Too Many Requests.

**Acceptance Criteria:**
1. A valid request always returns a success message regardless of email existence.
2. OTP is exactly 6 digits, generated using a cryptographically secure random source.
3. OTP is stored as a hash, never in plain text.
4. OTP expires after exactly 10 minutes.
5. Requesting a new OTP invalidates any previous active OTP for that email.
6. Rate limiting prevents more than 3 requests per email per hour.

**Related APIs:**
- `POST /api/auth/forgot-password`

**Related Screens:**
- UX-SCR-003: Forgot Password

---

#### FR-PWD-002: Verify OTP

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-PWD-002                                                                                 |
| **Description**   | The system SHALL verify the OTP provided by the user and return a time-limited password reset token. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1003                                                                                     |

**Preconditions:**
- User has requested a password reset and received an OTP.

**Main Flow:**
1. User enters their email and the 6-digit OTP.
2. System validates input fields.
3. System retrieves the active OTP record for the email.
4. System compares the provided OTP against the stored hash.
5. System checks that the OTP has not expired.
6. System invalidates the OTP (single use).
7. System generates a password reset token (valid for 15 minutes).
8. System returns the reset token.

**Error Cases:**
- EC-1: OTP is incorrect → 401 Unauthorized with error code `INVALID_OTP`.
- EC-2: OTP has expired → 410 Gone with error code `OTP_EXPIRED`.
- EC-3: No active OTP for the email → 401 Unauthorized with error code `INVALID_OTP`.
- EC-4: OTP already used → 401 Unauthorized with error code `INVALID_OTP`.
- EC-5: Rate limit exceeded (more than 5 attempts per email per hour) → 429 Too Many Requests.

**Acceptance Criteria:**
1. A correct, non-expired OTP returns a password reset token.
2. Each OTP can only be used once.
3. An expired OTP returns 410.
4. An incorrect OTP returns 401 without revealing whether an OTP exists.
5. Rate limiting prevents brute-force attempts.

**Related APIs:**
- `POST /api/auth/verify-otp`

**Related Screens:**
- UX-SCR-004: OTP Verification

---

#### FR-PWD-003: Reset Password

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-PWD-003                                                                                 |
| **Description**   | The system SHALL allow users to set a new password using a valid password reset token.      |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1003                                                                                     |

**Preconditions:**
- User has a valid, non-expired password reset token.

**Main Flow:**
1. User submits the new password and the password reset token.
2. System validates the new password meets complexity requirements.
3. System verifies the reset token is valid and not expired.
4. System hashes the new password with bcrypt (cost factor ≥ 12).
5. System updates the user's password in the database.
6. System invalidates the reset token.
7. System invalidates all existing refresh tokens for the user (force logout from all devices).
8. System returns a success response.

**Error Cases:**
- EC-1: Reset token is invalid → 401 Unauthorized with error code `INVALID_RESET_TOKEN`.
- EC-2: Reset token has expired → 410 Gone with error code `RESET_TOKEN_EXPIRED`.
- EC-3: New password does not meet complexity requirements → 422 Unprocessable Entity.
- EC-4: New password is the same as the current password → 422 Unprocessable Entity with error code `PASSWORD_SAME_AS_CURRENT`.

**Acceptance Criteria:**
1. A valid reset token allows the user to set a new password.
2. After password reset, all existing sessions are invalidated.
3. The new password is stored as a bcrypt hash.
4. The reset token is single-use and invalidated after successful reset.
5. The user can log in with the new password immediately.

**Related APIs:**
- `POST /api/auth/reset-password`

**Related Screens:**
- UX-SCR-005: Reset Password

---

### 9.3 Notes Management

#### FR-NOTE-001: Create Note

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-001                                                                                 |
| **Description**   | The system SHALL allow authenticated users to create a new note with a title and rich-text content. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1004                                                                                     |

**Preconditions:**
- User is authenticated.

**Main Flow:**
1. User opens the note editor.
2. User enters a title (optional; defaults to "Untitled").
3. User enters content using the rich-text editor.
4. User saves the note (explicitly or via autosave).
5. System validates the note data.
6. System creates the note record associated with the authenticated user.
7. System creates an initial version snapshot.
8. System returns the created note with its ID and timestamps.

**Alternate Flows:**
- AF-1: Autosave triggers after a debounce period — system saves without explicit user action.
- AF-2: User assigns tags during creation — tags are associated with the note.

**Error Cases:**
- EC-1: Title exceeds maximum length (255 characters) → 422 Unprocessable Entity.
- EC-2: Content exceeds maximum size (500 KB) → 413 Payload Too Large.
- EC-3: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Authenticated users can create notes with title and rich-text content.
2. Title defaults to "Untitled" if not provided.
3. Created note is associated with the authenticated user only.
4. An initial version snapshot is created automatically.
5. Response includes the note ID, title, content, and timestamps.

**Related APIs:**
- `POST /api/notes`

**Related Screens:**
- UX-SCR-007: Note Editor (Create/Edit)

---

#### FR-NOTE-002: Read Note

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-002                                                                                 |
| **Description**   | The system SHALL allow authenticated users to read their own notes by ID.                   |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1004                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists and belongs to the user.
- Note is not soft-deleted (or user is accessing via a restore flow).

**Main Flow:**
1. User requests a specific note by ID.
2. System verifies the user owns the note.
3. System retrieves the note with its current content, tags, and metadata.
4. System returns the full note object.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note belongs to another user → 404 Not Found (do not reveal existence).
- EC-3: Note is soft-deleted → 404 Not Found (for standard read; trash view is separate).
- EC-4: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Users can read their own notes by ID.
2. Note response includes title, content, tags, timestamps, and sharing status.
3. Users cannot read other users' notes.
4. Soft-deleted notes are not returned in standard reads.

**Related APIs:**
- `GET /api/notes/:id`

**Related Screens:**
- UX-SCR-007: Note Editor (Create/Edit)

---

#### FR-NOTE-003: Update Note

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-003                                                                                 |
| **Description**   | The system SHALL allow authenticated users to update the title, content, and tags of their own notes. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1004                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists, belongs to the user, and is not soft-deleted.

**Main Flow:**
1. User modifies the note title, content, and/or tags.
2. User saves (explicitly or via autosave).
3. System validates the updated data.
4. System updates the note record.
5. System creates a new version snapshot of the note content.
6. System updates the `updatedAt` timestamp.
7. System returns the updated note.

**Alternate Flows:**
- AF-1: Only title is updated — content snapshot is still created for consistency.
- AF-2: Tags are added or removed — tag associations are updated atomically.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note belongs to another user → 404 Not Found.
- EC-3: Note is soft-deleted → 404 Not Found.
- EC-4: Title exceeds maximum length → 422 Unprocessable Entity.
- EC-5: Content exceeds maximum size → 413 Payload Too Large.
- EC-6: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Users can update the title, content, and tags of their own notes.
2. Every save creates a new version snapshot.
3. The `updatedAt` timestamp is updated on every successful save.
4. Partial updates are supported (e.g., updating only the title).
5. Tag associations are updated atomically.

**Related APIs:**
- `PATCH /api/notes/:id`

**Related Screens:**
- UX-SCR-007: Note Editor (Create/Edit)

---

#### FR-NOTE-004: Soft Delete Note

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-004                                                                                 |
| **Description**   | The system SHALL soft-delete notes by setting a `deletedAt` timestamp. Notes SHALL remain recoverable for 30 days. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1004                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists, belongs to the user, and is not already soft-deleted.

**Main Flow:**
1. User requests deletion of a note.
2. System verifies ownership.
3. System sets the `deletedAt` timestamp to the current time.
4. System revokes any active share links for the note.
5. System returns a success response.

**Alternate Flows:**
- AF-1: User restores a soft-deleted note within the 30-day window — `deletedAt` is set to null.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note belongs to another user → 404 Not Found.
- EC-3: Note is already soft-deleted → 409 Conflict with error code `ALREADY_DELETED`.
- EC-4: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Soft delete sets `deletedAt` timestamp; row is never physically deleted within 30 days.
2. Soft-deleted notes do not appear in standard note listings.
3. Active share links are automatically revoked on soft delete.
4. Users can restore soft-deleted notes within 30 days.
5. Notes older than 30 days in the soft-deleted state MAY be permanently purged by a background process.

**Related APIs:**
- `DELETE /api/notes/:id`

**Related Screens:**
- UX-SCR-006: Dashboard (three-dot menu → "Move to trash")
- UX-SCR-007: Note Editor (More menu → "Move to trash")
- UX-SCR-008: Delete Confirmation

---

#### FR-NOTE-005: Restore Soft-Deleted Note

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-005                                                                                 |
| **Description**   | The system SHALL allow users to restore a soft-deleted note within the 30-day recovery window. |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1004                                                                                     |

**Preconditions:**
- User is authenticated.
- Note is soft-deleted and within the 30-day recovery window.

**Main Flow:**
1. User requests restoration of a soft-deleted note.
2. System verifies ownership and that the note is within the 30-day window.
3. System sets `deletedAt` to null.
4. System returns the restored note.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note is not soft-deleted → 409 Conflict with error code `NOT_DELETED`.
- EC-3: Recovery window has expired → 410 Gone with error code `RECOVERY_EXPIRED`.
- EC-4: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Soft-deleted notes within 30 days can be restored.
2. Restored notes appear in standard listings again.
3. Notes beyond the 30-day window cannot be restored.

**Related APIs:**
- `POST /api/notes/:id/restore`

**Related Screens:**
- UX-SCR-006: Dashboard (Trash view → "Restore" button)

---

#### FR-NOTE-006: List Notes with Pagination, Sorting, and Filtering

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-NOTE-006                                                                                 |
| **Description**   | The system SHALL return a paginated list of the user's notes with sorting and tag filtering options. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1005                                                                                     |

**Preconditions:**
- User is authenticated.

**Main Flow:**
1. User requests their notes list with optional parameters: page, pageSize, sortBy, sortOrder, tagIds, includeTrashed.
2. System applies default pagination (page 1, pageSize 20) if not specified.
3. System filters out soft-deleted notes unless `includeTrashed` is true.
4. System applies tag filters if tagIds are provided (AND logic for multiple tags).
5. System sorts results by the specified field (default: `updatedAt` descending).
6. System returns the paginated result with total count and pagination metadata.

**Alternate Flows:**
- AF-1: No notes exist — system returns an empty list with total count 0.
- AF-2: User requests trashed notes only — system filters to only soft-deleted notes within 30-day window.

**Error Cases:**
- EC-1: Invalid page or pageSize → 422 Unprocessable Entity.
- EC-2: Invalid sortBy field → 422 Unprocessable Entity.
- EC-3: Invalid tag IDs → 422 Unprocessable Entity.
- EC-4: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Notes are paginated with configurable page size (default 20, max 100).
2. Sorting is supported by: `createdAt`, `updatedAt`, `title` in ascending or descending order.
3. Filtering by one or more tag IDs uses AND logic (note must have all specified tags).
4. Soft-deleted notes are excluded by default.
5. Response includes: notes array, total count, current page, page size, total pages.
6. Results only include notes owned by the authenticated user.

**Related APIs:**
- `GET /api/notes`

**Related Screens:**
- UX-SCR-006: Dashboard / Notes List

---

### 9.4 Tags

#### FR-TAG-001: Create Tag

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-TAG-001                                                                                 |
| **Description**   | The system SHALL allow authenticated users to create user-scoped tags with a name and optional color. |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1006                                                                                     |

**Preconditions:**
- User is authenticated.

**Main Flow:**
1. User provides a tag name and optional hex color code.
2. System validates the tag name and color format.
3. System checks that the tag name is unique within the user's scope.
4. System creates the tag record.
5. System returns the created tag with its ID.

**Error Cases:**
- EC-1: Tag name already exists for this user → 409 Conflict with error code `TAG_NAME_EXISTS`.
- EC-2: Tag name exceeds maximum length (50 characters) → 422 Unprocessable Entity.
- EC-3: Tag name is empty or whitespace-only → 422 Unprocessable Entity.
- EC-4: Invalid color format (must be 7-character hex: #RRGGBB) → 422 Unprocessable Entity.
- EC-5: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Users can create tags with a name and optional color.
2. Tag names are unique per user (case-insensitive).
3. Default color is assigned if none is provided.
4. Tag names are trimmed of leading/trailing whitespace before storage.

**Related APIs:**
- `POST /api/tags`

**Related Screens:**
- UX-SCR-010: Tag Management Modal
- UX-SCR-007: Note Editor (inline tag creation)

---

#### FR-TAG-002: List Tags with Note Counts

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-TAG-002                                                                                 |
| **Description**   | The system SHALL return all tags belonging to the authenticated user, each with a count of associated non-deleted notes. |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1006                                                                                     |

**Preconditions:**
- User is authenticated.

**Main Flow:**
1. User requests their tag list.
2. System retrieves all tags owned by the user.
3. System computes the count of non-soft-deleted notes for each tag.
4. System returns the tag list sorted alphabetically by name.

**Acceptance Criteria:**
1. All user-scoped tags are returned with accurate note counts.
2. Note counts exclude soft-deleted notes.
3. Tags with zero notes are still returned.
4. Tags are sorted alphabetically by name by default.

**Related APIs:**
- `GET /api/tags`

**Related Screens:**
- UX-SCR-006: Dashboard (sidebar tag list)

---

#### FR-TAG-003: Update Tag

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-TAG-003                                                                                 |
| **Description**   | The system SHALL allow users to update a tag's name and/or color.                           |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1006                                                                                     |

**Preconditions:**
- User is authenticated.
- Tag exists and belongs to the user.

**Main Flow:**
1. User submits updated tag name and/or color.
2. System validates the new values.
3. System checks uniqueness of the new name within the user's scope (if name changed).
4. System updates the tag record.
5. System returns the updated tag.

**Error Cases:**
- EC-1: Tag not found → 404 Not Found.
- EC-2: Tag belongs to another user → 404 Not Found.
- EC-3: New name already exists for this user → 409 Conflict.
- EC-4: Validation errors → 422 Unprocessable Entity.

**Acceptance Criteria:**
1. Users can update the name and color of their own tags.
2. Uniqueness is enforced for the new name.
3. Updating a tag name does not affect its associations with notes.

**Related APIs:**
- `PATCH /api/tags/:id`

**Related Screens:**
- UX-SCR-010: Tag Management Modal (inline edit mode)

---

#### FR-TAG-004: Delete Tag

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-TAG-004                                                                                 |
| **Description**   | The system SHALL allow users to delete a tag. The tag is removed from all associated notes.  |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1006                                                                                     |

**Preconditions:**
- User is authenticated.
- Tag exists and belongs to the user.

**Main Flow:**
1. User requests deletion of a tag.
2. System removes the tag-to-note associations.
3. System deletes the tag record (hard delete — tags are not soft-deleted).
4. System returns a success response.

**Error Cases:**
- EC-1: Tag not found → 404 Not Found.
- EC-2: Tag belongs to another user → 404 Not Found.

**Acceptance Criteria:**
1. Deleting a tag removes it from all associated notes.
2. The notes themselves are not affected (only the tag association is removed).
3. Tag deletion is a hard delete (permanent).

**Related APIs:**
- `DELETE /api/tags/:id`

**Related Screens:**
- UX-SCR-010: Tag Management Modal (delete button)

---

### 9.5 Search

#### FR-SRCH-001: Full-Text Search

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-SRCH-001                                                                                 |
| **Description**   | The system SHALL provide full-text search across note titles and content for the authenticated user, with keyword highlighting in results. |
| **Priority**      | P0 — Critical                                                                               |
| **Ticket**        | AB-1007                                                                                     |

**Preconditions:**
- User is authenticated.
- At least one note exists.

**Main Flow:**
1. User enters a search query (minimum 1 character).
2. System performs a PostgreSQL full-text search across note titles and content.
3. System filters results to only the user's non-deleted notes.
4. System generates highlighted snippets showing matching keywords in context.
5. System returns paginated results sorted by relevance (rank).

**Alternate Flows:**
- AF-1: No results found — system returns an empty list with total count 0.
- AF-2: User combines search with tag filter — both filters are applied (AND logic).

**Error Cases:**
- EC-1: Empty search query → 422 Unprocessable Entity.
- EC-2: Search query exceeds maximum length (200 characters) → 422 Unprocessable Entity.
- EC-3: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. Search covers both note title and content.
2. Results include highlighted snippets with matching keywords wrapped in `<mark>` tags.
3. Results are sorted by relevance (PostgreSQL `ts_rank`).
4. Results are paginated (default page size 20).
5. Only the user's own non-deleted notes are searchable.
6. Search supports PostgreSQL text search features (stemming, prefix matching).
7. Search results include the note ID, title, highlighted snippet, relevance score, and timestamps.

**Related APIs:**
- `GET /api/search`

**Related Screens:**
- UX-SCR-009: Search Results
- UX-SCR-006: Dashboard (search input in sidebar)

---

### 9.6 Sharing

#### FR-SHARE-001: Generate Share Link

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-SHARE-001                                                                                |
| **Description**   | The system SHALL allow authenticated users to generate a public read-only share link for a note, with a configurable expiry period. |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1008                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists, belongs to the user, and is not soft-deleted.

**Main Flow:**
1. User requests a share link for a note, optionally specifying an expiry period.
2. System generates a unique, unguessable share token (UUID v4 or equivalent).
3. System creates a share record with the token, note ID, expiry timestamp, and view count initialized to 0.
4. System returns the full share URL and metadata.

**Alternate Flows:**
- AF-1: Note already has an active share link — system returns the existing link (does not create a duplicate).
- AF-2: No expiry specified — system uses a default expiry of 7 days.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note belongs to another user → 404 Not Found.
- EC-3: Note is soft-deleted → 404 Not Found.
- EC-4: Invalid expiry value (must be between 1 hour and 30 days) → 422 Unprocessable Entity.
- EC-5: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. A unique, unguessable share link is generated for the note.
2. The share link allows read-only public access without authentication.
3. Default expiry is 7 days; configurable between 1 hour and 30 days.
4. A note can have at most one active share link at a time.
5. View count starts at 0.
6. Response includes the share URL, token, expiry timestamp, and creation time.

**Related APIs:**
- `POST /api/notes/:id/share`

**Related Screens:**
- UX-SCR-011: Share Modal

---

#### FR-SHARE-002: Access Shared Note (Public)

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-SHARE-002                                                                                |
| **Description**   | The system SHALL allow anyone with a valid share link to view the note in read-only mode, and SHALL atomically increment the view count. |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1008                                                                                     |

**Preconditions:**
- The share token is valid and the share link has not expired.

**Main Flow:**
1. Anonymous or authenticated user accesses the share URL with the token.
2. System validates the share token exists and has not expired.
3. System atomically increments the view count.
4. System returns the note content in read-only mode (title, content, author display name, creation date).

**Error Cases:**
- EC-1: Share token not found → 404 Not Found.
- EC-2: Share link has expired → 410 Gone with error code `SHARE_LINK_EXPIRED`.
- EC-3: Associated note has been soft-deleted → 404 Not Found.

**Acceptance Criteria:**
1. Anyone with the share link can view the note without authentication.
2. The note is displayed in read-only mode; no edit controls are shown.
3. View count is incremented atomically (concurrent access safe).
4. Expired share links return 410.
5. The shared view includes the note title, content, and author's display name.
6. The shared view does NOT expose the author's email, note ID, tags, or version history.

**Related APIs:**
- `GET /api/shared/:token`

**Related Screens:**
- UX-SCR-013: Shared Note View (Public)

---

#### FR-SHARE-003: Revoke Share Link

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-SHARE-003                                                                                |
| **Description**   | The system SHALL allow the note owner to revoke an active share link.                       |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1008                                                                                     |

**Preconditions:**
- User is authenticated.
- Note has an active share link.

**Main Flow:**
1. User requests revocation of the share link for a note.
2. System deletes the share record.
3. System returns a success response.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note has no active share link → 404 Not Found.
- EC-3: Note belongs to another user → 404 Not Found.
- EC-4: Unauthorized request → 401 Unauthorized.

**Acceptance Criteria:**
1. After revocation, the share link is no longer accessible.
2. Anyone attempting to access the revoked link receives 404.
3. The note itself is unaffected by revocation.

**Related APIs:**
- `DELETE /api/notes/:id/share`

**Related Screens:**
- UX-SCR-011: Share Modal (Revoke Link button)

---

#### FR-SHARE-004: List Active Share Links

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-SHARE-004                                                                                |
| **Description**   | The system SHALL allow authenticated users to list all their active (non-expired) share links with metadata. |
| **Priority**      | P2 — Medium                                                                                 |
| **Ticket**        | AB-1008                                                                                     |

**Preconditions:**
- User is authenticated.

**Main Flow:**
1. User requests a list of their active share links.
2. System retrieves all non-expired share records for the user's notes.
3. System returns the list with: note title, share URL, expiry timestamp, view count, creation time.

**Acceptance Criteria:**
1. Only non-expired share links are returned.
2. Each entry includes the associated note title, share URL, expiry, view count, and creation time.

**Related APIs:**
- `GET /api/shares`

**Related Screens:**
- UX-SCR-011: Share Modal (active link state)

---

### 9.7 Version History

#### FR-VER-001: Automatic Version Snapshot

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-VER-001                                                                                 |
| **Description**   | The system SHALL create a version snapshot every time a note is saved (created or updated). |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1009                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists and belongs to the user.

**Main Flow:**
1. When a note is created or updated, the system captures the current title and content.
2. System creates a new version record with: note ID, version number (auto-incrementing per note), title snapshot, content snapshot, and timestamp.
3. The version number increments sequentially for each note independently.

**Acceptance Criteria:**
1. Every save operation creates exactly one version snapshot.
2. Version numbers are sequential per note (1, 2, 3, ...).
3. The snapshot captures the complete title and content at the time of save.
4. Version records are immutable — they cannot be edited or deleted individually.

**Related APIs:**
- Triggered internally by `POST /api/notes` and `PATCH /api/notes/:id`

**Related Screens:**
- UX-SCR-012: Version History Drawer (version list)

---

#### FR-VER-002: List Version History

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-VER-002                                                                                 |
| **Description**   | The system SHALL return the version history of a note, ordered from newest to oldest.       |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1009                                                                                     |

**Preconditions:**
- User is authenticated.
- Note exists and belongs to the user.

**Main Flow:**
1. User requests the version history for a note.
2. System retrieves all version records for the note.
3. System returns the versions sorted by version number descending (newest first).
4. Each version entry includes: version number, title, timestamp, and a preview snippet (first 200 characters of content).

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Note belongs to another user → 404 Not Found.

**Acceptance Criteria:**
1. Version history is returned sorted newest-first.
2. Each version includes version number, title, timestamp, and content preview.
3. Full content is not included in the list response (only preview snippet).

**Related APIs:**
- `GET /api/notes/:id/versions`

**Related Screens:**
- UX-SCR-012: Version History Drawer

---

#### FR-VER-003: View Specific Version

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-VER-003                                                                                 |
| **Description**   | The system SHALL allow users to view the full content of any specific version of a note.    |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1009                                                                                     |

**Preconditions:**
- User is authenticated.
- Note and version exist and belong to the user.

**Main Flow:**
1. User requests a specific version by note ID and version number.
2. System retrieves the full version snapshot.
3. System returns the complete title, content, version number, and timestamp.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Version not found → 404 Not Found.
- EC-3: Note belongs to another user → 404 Not Found.

**Acceptance Criteria:**
1. Users can view the full content of any version.
2. The response includes the complete title and content of the snapshot.
3. Viewing a version does not modify the current note or create a new version.

**Related APIs:**
- `GET /api/notes/:id/versions/:versionNumber`

**Related Screens:**
- UX-SCR-012: Version History Drawer (preview mode)

---

#### FR-VER-004: Restore Version

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-VER-004                                                                                 |
| **Description**   | The system SHALL allow users to restore a previous version, which creates a new version with the restored content (not a rollback). |
| **Priority**      | P1 — High                                                                                   |
| **Ticket**        | AB-1009                                                                                     |

**Preconditions:**
- User is authenticated.
- Note and version exist and belong to the user.
- Note is not soft-deleted.

**Main Flow:**
1. User requests restoration of a specific version.
2. System retrieves the version snapshot's title and content.
3. System updates the note's current title and content with the version's data.
4. System creates a new version snapshot (this is a new version, not a rewrite of history).
5. System returns the updated note.

**Error Cases:**
- EC-1: Note not found → 404 Not Found.
- EC-2: Version not found → 404 Not Found.
- EC-3: Note belongs to another user → 404 Not Found.
- EC-4: Note is soft-deleted → 404 Not Found.

**Acceptance Criteria:**
1. Restoring a version creates a new version (does not delete or overwrite any existing versions).
2. The current note content is updated to match the restored version.
3. The version history shows the restoration as the latest version.
4. Previous versions remain accessible.

**Related APIs:**
- `POST /api/notes/:id/versions/:versionNumber/restore`

**Related Screens:**
- UX-SCR-012: Version History Drawer (Restore button)

---

#### FR-VER-005: Auto-Purge Old Versions

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Requirement ID**| FR-VER-005                                                                                 |
| **Description**   | The system SHOULD automatically purge version snapshots older than 90 days, retaining at minimum the 10 most recent versions per note regardless of age. |
| **Priority**      | P2 — Medium                                                                                 |
| **Ticket**        | AB-1009                                                                                     |

**Main Flow:**
1. A scheduled background process identifies version records older than 90 days.
2. For each note, the process retains the 10 most recent versions regardless of age.
3. Eligible older versions are permanently deleted.

**Acceptance Criteria:**
1. Versions older than 90 days are candidates for purging.
2. The 10 most recent versions per note are always retained.
3. Purging runs as a background process and does not impact user requests.

**Related APIs:**
- N/A (background scheduled process)

**Related Screens:**
- N/A (no user-facing interface)

---

## 10. Detailed User Stories

### 10.1 Authentication Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-001   | New User           | Register with my email and password            | I can start using the application             | FR-AUTH-001          |
| US-002   | Registered User    | Log in with my credentials                    | I can access my notes                         | FR-AUTH-002          |
| US-003   | Logged-in User     | Log out                                        | My session is ended securely                  | FR-AUTH-004          |
| US-004   | User               | Have my session automatically refresh          | I don't have to log in every 15 minutes       | FR-AUTH-003          |
| US-005   | User who forgot    | Request a password reset OTP                   | I can regain access to my account             | FR-PWD-001           |
| US-006   | User with OTP      | Verify my OTP and set a new password           | My account is secured with a new password     | FR-PWD-002, FR-PWD-003 |

### 10.2 Notes Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-010   | User               | Create a new note with a rich-text editor      | I can capture formatted information           | FR-NOTE-001          |
| US-011   | User               | View all my notes in a list                    | I can browse and find my content              | FR-NOTE-006          |
| US-012   | User               | Edit an existing note                          | I can update and refine my content            | FR-NOTE-002, FR-NOTE-003 |
| US-013   | User               | Delete a note                                  | I can remove content I no longer need         | FR-NOTE-004          |
| US-014   | User               | Restore a deleted note within 30 days          | I can recover accidentally deleted content    | FR-NOTE-005          |
| US-015   | User               | Sort my notes by date or title                 | I can organize my view preference             | FR-NOTE-006          |
| US-016   | User               | Filter my notes by tags                        | I can focus on a specific category            | FR-NOTE-006, FR-TAG-002 |
| US-017   | User               | Have my notes autosave                         | I never lose work due to forgetting to save   | FR-NOTE-003          |

### 10.3 Tags Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-020   | User               | Create a tag with a custom color               | I can visually categorize my notes            | FR-TAG-001           |
| US-021   | User               | See how many notes each tag has                | I understand my content distribution          | FR-TAG-002           |
| US-022   | User               | Rename or recolor a tag                        | I can refine my organization scheme           | FR-TAG-003           |
| US-023   | User               | Delete a tag                                   | I can clean up unused categories              | FR-TAG-004           |
| US-024   | User               | Assign multiple tags to a note                 | I can categorize notes flexibly               | FR-NOTE-003, FR-TAG-001 |

### 10.4 Search Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-030   | User               | Search across all my notes                     | I can find information quickly                | FR-SRCH-001          |
| US-031   | User               | See highlighted keywords in search results     | I can identify relevant matches at a glance   | FR-SRCH-001          |
| US-032   | User               | Page through search results                    | I can find what I need even with many matches | FR-SRCH-001          |

### 10.5 Sharing Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-040   | User               | Generate a public link for a note              | I can share content with anyone               | FR-SHARE-001         |
| US-041   | User               | Set an expiry on the share link                | The link automatically becomes inactive       | FR-SHARE-001         |
| US-042   | User               | See how many times a shared note was viewed    | I understand the reach of shared content      | FR-SHARE-004         |
| US-043   | User               | Revoke a share link                            | I can stop public access immediately          | FR-SHARE-003         |
| US-044   | Anonymous visitor  | View a shared note without logging in          | I can read content shared with me             | FR-SHARE-002         |

### 10.6 Version History Stories

| Story ID | As a...            | I want to...                                  | So that...                                    | Related Requirements |
| -------- | ------------------ | --------------------------------------------- | --------------------------------------------- | -------------------- |
| US-050   | User               | View the version history of a note             | I can see how my note evolved over time       | FR-VER-002           |
| US-051   | User               | View a specific past version                   | I can review what the note looked like before | FR-VER-003           |
| US-052   | User               | Restore a past version                         | I can revert to a previous state of my note   | FR-VER-004           |

---

## 11. Acceptance Criteria

### 11.1 System-Level Acceptance Criteria

| ID      | Criterion                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- |
| AC-SYS-001 | The application builds with zero TypeScript errors and zero warnings.                    |
| AC-SYS-002 | All lint rules pass with `--max-warnings 0`.                                             |
| AC-SYS-003 | All unit and integration tests pass with ≥80% coverage on new code.                      |
| AC-SYS-004 | The E2E test suite (Playwright) passes the full user journey.                            |
| AC-SYS-005 | All API endpoints return the correct HTTP status codes as specified in the SDS.           |
| AC-SYS-006 | All error responses follow the standardized error response format.                       |
| AC-SYS-007 | The application is responsive and functional on viewports ≥320px.                        |
| AC-SYS-008 | All interactive elements are keyboard accessible.                                         |
| AC-SYS-009 | No sensitive data (passwords, tokens) appears in logs or API responses.                  |
| AC-SYS-010 | The application meets WCAG 2.2 AA compliance guidelines.                                 |

### 11.2 Feature-Level Acceptance Criteria

Feature-level acceptance criteria are defined inline within each functional requirement in Section 9.

---

## 12. Business Rules

| Rule ID  | Rule                                                                                        | Related Requirements |
| -------- | ------------------------------------------------------------------------------------------- | -------------------- |
| BR-001   | Each user account is identified by a unique email address (case-insensitive).               | FR-AUTH-001          |
| BR-002   | A user can only access, modify, or delete their own notes.                                  | FR-NOTE-001 – FR-NOTE-006 |
| BR-003   | Soft-deleted notes are recoverable for exactly 30 calendar days from the deletion timestamp.| FR-NOTE-004, FR-NOTE-005 |
| BR-004   | A note can have zero or more tags. A tag can be associated with zero or more notes.         | FR-TAG-001, FR-NOTE-003 |
| BR-005   | Tag names are unique within a user's scope (case-insensitive comparison).                   | FR-TAG-001, FR-TAG-003 |
| BR-006   | A note can have at most one active share link at any time.                                  | FR-SHARE-001         |
| BR-007   | Share link expiry is configurable between 1 hour and 30 days, defaulting to 7 days.         | FR-SHARE-001         |
| BR-008   | Every note save (create or update) creates exactly one version snapshot.                    | FR-VER-001           |
| BR-009   | Restoring a version creates a new version; it does not rewrite history.                     | FR-VER-004           |
| BR-010   | OTP for password reset is valid for exactly 10 minutes and is single-use.                   | FR-PWD-001, FR-PWD-002 |
| BR-011   | Access tokens expire after 15 minutes; refresh tokens expire after 7 days.                  | FR-AUTH-002, FR-AUTH-003 |
| BR-012   | Refresh tokens are rotated on every use (used token is invalidated, new one is issued).     | FR-AUTH-003          |
| BR-013   | Password reset invalidates all existing refresh tokens for the user.                        | FR-PWD-003           |
| BR-014   | Soft-deleting a note automatically revokes any active share link for that note.             | FR-NOTE-004, FR-SHARE-003 |
| BR-015   | Email addresses are stored in lowercase.                                                    | FR-AUTH-001          |
| BR-016   | Tags are hard-deleted (not soft-deleted).                                                   | FR-TAG-004           |
| BR-017   | Version snapshots are immutable — they cannot be individually edited or deleted.            | FR-VER-001           |
| BR-018   | The system retains a minimum of 10 versions per note, regardless of age.                    | FR-VER-005           |
| BR-019   | Versions older than 90 days may be auto-purged, subject to BR-018.                          | FR-VER-005           |
| BR-020   | View count on shared notes is incremented atomically to prevent race conditions.            | FR-SHARE-002         |

---

## 13. Validation Rules

### 13.1 User Registration & Authentication

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Name        | Required. 1–100 characters. Trimmed of leading/trailing whitespace.                         | FR-AUTH-001          |
| Email       | Required. Valid email format per RFC 5322 (simplified). Max 255 characters. Stored lowercase.| FR-AUTH-001, FR-AUTH-002 |
| Password    | Required. Min 8 characters. Must contain at least: 1 uppercase letter, 1 lowercase letter, 1 digit, 1 special character (!@#$%^&*). Max 128 characters. | FR-AUTH-001, FR-PWD-003 |

### 13.2 Notes

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Title       | Optional (defaults to "Untitled"). Max 255 characters. Trimmed.                             | FR-NOTE-001, FR-NOTE-003 |
| Content     | Optional (empty note allowed). Max 500 KB in size. Rich-text HTML content.                  | FR-NOTE-001, FR-NOTE-003 |

### 13.3 Tags

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Name        | Required. 1–50 characters. Trimmed. Unique per user (case-insensitive).                     | FR-TAG-001, FR-TAG-003 |
| Color       | Optional. Must be valid 7-character hex color (#RRGGBB format). Defaults to system color.   | FR-TAG-001, FR-TAG-003 |

### 13.4 Search

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Query       | Required. 1–200 characters. Trimmed. Leading/trailing whitespace removed.                   | FR-SRCH-001          |

### 13.5 Sharing

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Expiry      | Optional. Integer representing hours (min: 1, max: 720 — i.e., 30 days). Default: 168 (7 days). | FR-SHARE-001         |

### 13.6 Pagination

| Field       | Rule                                                                                        | Related Requirements |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| Page        | Optional. Positive integer ≥ 1. Default: 1.                                                | FR-NOTE-006, FR-SRCH-001 |
| Page Size   | Optional. Integer 1–100. Default: 20.                                                       | FR-NOTE-006, FR-SRCH-001 |
| Sort By     | Optional. Allowed values: `createdAt`, `updatedAt`, `title`. Default: `updatedAt`.          | FR-NOTE-006          |
| Sort Order  | Optional. Allowed values: `asc`, `desc`. Default: `desc`.                                   | FR-NOTE-006          |

---

## 14. Error Catalogue

### 14.1 Authentication Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Email already registered            | 409         | `EMAIL_ALREADY_EXISTS`    | An account with this email already exists.     | FR-AUTH-001          | UX-SCR-001       |
| Invalid credentials                 | 401         | `INVALID_CREDENTIALS`     | Invalid email or password.                     | FR-AUTH-002          | UX-SCR-002       |
| Access token missing                | 401         | `TOKEN_MISSING`           | Authentication required.                       | FR-AUTH-003          | All authenticated |
| Access token expired                | 401         | `TOKEN_EXPIRED`           | Session expired. Please log in again.          | FR-AUTH-003          | All authenticated |
| Access token malformed              | 401         | `TOKEN_INVALID`           | Invalid authentication token.                  | FR-AUTH-003          | All authenticated |
| Refresh token invalid               | 401         | `INVALID_REFRESH_TOKEN`   | Invalid refresh token.                         | FR-AUTH-003          | N/A (API client) |
| Refresh token expired               | 401         | `REFRESH_TOKEN_EXPIRED`   | Refresh token expired. Please log in again.    | FR-AUTH-003          | N/A (API client) |

### 14.2 Password Reset Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Invalid OTP                         | 401         | `INVALID_OTP`             | The code you entered is incorrect.             | FR-PWD-002           | UX-SCR-004       |
| OTP expired                         | 410         | `OTP_EXPIRED`             | This code has expired. Request a new one.      | FR-PWD-002           | UX-SCR-004       |
| Reset token invalid                 | 401         | `INVALID_RESET_TOKEN`     | Invalid password reset link.                   | FR-PWD-003           | UX-SCR-005       |
| Reset token expired                 | 410         | `RESET_TOKEN_EXPIRED`     | Password reset link expired. Request a new one.| FR-PWD-003           | UX-SCR-005       |
| Same password as current            | 422         | `PASSWORD_SAME_AS_CURRENT`| New password must be different from the current.| FR-PWD-003           | UX-SCR-005       |
| OTP rate limit exceeded             | 429         | `OTP_RATE_LIMIT`          | Too many requests. Try again later.            | FR-PWD-001           | UX-SCR-003       |
| OTP verification rate limit         | 429         | `OTP_VERIFY_RATE_LIMIT`   | Too many attempts. Try again later.            | FR-PWD-002           | UX-SCR-004       |

### 14.3 Notes Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Note not found                      | 404         | `NOTE_NOT_FOUND`          | Note not found.                                | FR-NOTE-002 – FR-NOTE-006 | UX-SCR-007  |
| Note already soft-deleted           | 409         | `ALREADY_DELETED`         | This note has already been deleted.            | FR-NOTE-004          | UX-SCR-008       |
| Note not soft-deleted (restore)     | 409         | `NOT_DELETED`             | This note is not in the trash.                 | FR-NOTE-005          | UX-SCR-006       |
| Recovery window expired             | 410         | `RECOVERY_EXPIRED`        | This note can no longer be recovered.          | FR-NOTE-005          | UX-SCR-006       |
| Content too large                   | 413         | `CONTENT_TOO_LARGE`       | Note content exceeds the maximum allowed size. | FR-NOTE-001, FR-NOTE-003 | UX-SCR-007  |

### 14.4 Tags Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Tag name already exists             | 409         | `TAG_NAME_EXISTS`         | A tag with this name already exists.           | FR-TAG-001, FR-TAG-003 | UX-SCR-010     |
| Tag not found                       | 404         | `TAG_NOT_FOUND`           | Tag not found.                                 | FR-TAG-003, FR-TAG-004 | UX-SCR-010     |

### 14.5 Sharing Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Share link expired                  | 410         | `SHARE_LINK_EXPIRED`      | This share link has expired.                   | FR-SHARE-002         | UX-SCR-013       |
| Share link not found                | 404         | `SHARE_LINK_NOT_FOUND`    | Share link not found.                          | FR-SHARE-002, FR-SHARE-003 | UX-SCR-013, UX-SCR-011 |

### 14.6 Version History Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Version not found                   | 404         | `VERSION_NOT_FOUND`       | Version not found.                             | FR-VER-002 – FR-VER-004 | UX-SCR-012    |

### 14.7 General Errors

| Scenario                            | HTTP Status | Error Code                | User-Facing Message                            | Related Requirements | Affected Screens |
| ----------------------------------- | ----------- | ------------------------- | ---------------------------------------------- | -------------------- | ---------------- |
| Validation error                    | 422         | `VALIDATION_ERROR`        | (Dynamic field-level messages)                 | All                  | All              |
| Rate limit exceeded                 | 429         | `RATE_LIMIT_EXCEEDED`     | Too many requests. Please try again later.     | All                  | All              |
| Internal server error               | 500         | `INTERNAL_ERROR`          | An unexpected error occurred. Please try again.| All                  | All              |
| Method not allowed                  | 405         | `METHOD_NOT_ALLOWED`      | Method not allowed.                            | All                  | N/A              |
| Route not found                     | 404         | `ROUTE_NOT_FOUND`         | The requested resource was not found.          | All                  | N/A              |

---

## 15. Non-Functional Requirements

### 15.1 Overview

| ID       | Category        | Requirement                                                              |
| -------- | --------------- | ------------------------------------------------------------------------ |
| NFR-001  | Availability    | The application SHOULD target 99.5% uptime.                             |
| NFR-002  | Latency         | API responses SHOULD complete within 200ms for CRUD operations (p95).    |
| NFR-003  | Search Latency  | Full-text search SHOULD complete within 500ms (p95).                     |
| NFR-004  | Concurrent Users| The system SHOULD support at least 100 concurrent authenticated users.   |
| NFR-005  | Data Integrity  | All database mutations MUST be wrapped in transactions where needed.     |
| NFR-006  | Scalability     | The database schema MUST support efficient indexing for anticipated load.|
| NFR-007  | Maintainability | Code coverage MUST be ≥80% on all new code.                             |

---

## 16. Security Requirements

| ID       | Requirement                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| SEC-001  | Passwords MUST be hashed using bcrypt with a cost factor of ≥12. Never stored in plain text. |
| SEC-002  | OTPs MUST be hashed before storage. Never stored in plain text.                              |
| SEC-003  | JWT access tokens MUST be signed with a strong secret key (min 256 bits).                    |
| SEC-004  | Refresh tokens MUST be stored in the database and rotated on every use.                      |
| SEC-005  | All API endpoints (except registration, login, password reset, and public share access) MUST require a valid JWT access token. |
| SEC-006  | Users MUST only access their own resources. Cross-user data access MUST be prevented at the query level. |
| SEC-007  | API responses for non-existent or unauthorized resources MUST return 404 (never 403) to prevent information leakage. |
| SEC-008  | All user input MUST be validated and sanitized on the server side, regardless of client-side validation. |
| SEC-009  | Rich-text content MUST be sanitized to prevent XSS attacks before storage and rendering.     |
| SEC-010  | CORS MUST be configured to allow only the frontend origin.                                   |
| SEC-011  | Rate limiting MUST be applied to authentication endpoints, OTP endpoints, and API endpoints. |
| SEC-012  | Share tokens MUST be unguessable (UUID v4 or equivalent entropy).                            |
| SEC-013  | HTTP security headers MUST be set: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-XSS-Protection`. |
| SEC-014  | Error messages MUST NOT expose internal system details (stack traces, query text, etc.).      |
| SEC-015  | Password reset invalidates all active sessions (refresh tokens) for the user.                |
| SEC-016  | Sensitive fields (password, OTP, tokens) MUST never appear in API response bodies or logs.   |

---

## 17. Performance Requirements

| ID       | Requirement                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| PERF-001 | Note list API MUST return results within 200ms (p95) for users with up to 1,000 notes.      |
| PERF-002 | Full-text search MUST return results within 500ms (p95) for users with up to 1,000 notes.    |
| PERF-003 | Note creation and update MUST complete within 300ms (p95) including version snapshot.        |
| PERF-004 | The frontend initial bundle size SHOULD be under 500 KB gzipped.                             |
| PERF-005 | The frontend SHOULD implement code splitting for non-critical routes.                        |
| PERF-006 | Database queries MUST use appropriate indexes to avoid full table scans.                      |
| PERF-007 | Autosave MUST be debounced (minimum 2 seconds) to prevent excessive API calls.               |
| PERF-008 | Shared note view MUST load within 1 second (p95) including view count increment.             |

---

## 18. Accessibility Requirements

| ID       | Requirement                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| A11Y-001 | The application MUST meet WCAG 2.2 Level AA compliance.                                     |
| A11Y-002 | All form fields MUST have associated labels or `aria-label` attributes.                      |
| A11Y-003 | All interactive elements MUST be operable via keyboard alone.                                |
| A11Y-004 | Focus order MUST follow a logical reading order.                                             |
| A11Y-005 | All non-decorative images and icons MUST have alt text or `aria-label`.                      |
| A11Y-006 | Color MUST NOT be the sole means of conveying information.                                   |
| A11Y-007 | Text color contrast MUST meet a minimum ratio of 4.5:1 for normal text and 3:1 for large text. |
| A11Y-008 | Error messages MUST be announced to screen readers via `aria-live` regions.                   |
| A11Y-009 | Modals MUST trap focus and return focus to the trigger element on close.                     |
| A11Y-010 | The rich-text editor MUST provide keyboard shortcuts for all formatting options.             |
| A11Y-011 | Skip-to-content link MUST be provided on pages with complex navigation.                     |

---

## 19. Browser Support

| Browser                   | Minimum Version | Support Level |
| ------------------------- | --------------- | ------------- |
| Google Chrome             | Latest 2        | Full          |
| Mozilla Firefox           | Latest 2        | Full          |
| Apple Safari              | Latest 2        | Full          |
| Microsoft Edge (Chromium) | Latest 2        | Full          |

> **Note:** Internet Explorer is not supported.

---

## 20. Logging & Auditing Requirements

| ID       | Requirement                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| LOG-001  | All API requests MUST be logged with: timestamp, method, path, status code, response time, user ID (if authenticated). |
| LOG-002  | Authentication events MUST be logged: login success, login failure, logout, token refresh, password reset request, password reset success. |
| LOG-003  | Note lifecycle events MUST be logged: create, update, soft-delete, restore.                  |
| LOG-004  | Share link events MUST be logged: create, revoke, access (public view), expiry.              |
| LOG-005  | Simulated email content (OTP, verification) MUST be logged to console with clear formatting. |
| LOG-006  | Logs MUST NOT contain sensitive data: passwords, tokens, OTPs, or personal content.          |
| LOG-007  | Logs MUST use structured format (JSON) with consistent field names.                          |
| LOG-008  | Error logs MUST include a correlation ID for request tracing.                                |

---

## 21. Constraints

| ID       | Constraint                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| CON-001  | The technology stack is fixed and SHALL NOT be substituted (see Section 3 of assignment).     |
| CON-002  | The monorepo MUST use pnpm workspaces.                                                       |
| CON-003  | All TypeScript types and Zod schemas MUST reside in `packages/shared`.                       |
| CON-004  | Full-text search MUST use PostgreSQL's built-in capabilities — no external search service.   |
| CON-005  | Email functionality MUST be simulated (console logging only).                                |
| CON-006  | The ticket sequence (AB-1001 through AB-1016) MUST be followed in order.                     |
| CON-007  | Soft delete means `deletedAt` timestamp only; physical deletion is prohibited within 30 days.|
| CON-008  | All tool versions MUST be pinned in `package.json` (no `@latest` in install commands).       |
| CON-009  | Every commit MUST follow conventional commit format: `type(scope): description AB#ticket`.   |
| CON-010  | Husky pre-commit hooks MUST enforce lint, test, and TypeScript checks.                       |

---

## 22. Assumptions

| ID       | Assumption                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| ASM-001  | Users have access to a modern web browser (see Section 19).                                  |
| ASM-002  | Users have a stable internet connection.                                                     |
| ASM-003  | PostgreSQL 16 is available and configured in the deployment environment.                     |
| ASM-004  | Node.js 22 runtime is available in the deployment environment.                               |
| ASM-005  | A single-server deployment is sufficient; distributed deployment is not required at this stage. |
| ASM-006  | The user base is expected to be small to medium (hundreds to low thousands of users).        |
| ASM-007  | Users will access the application via desktop or mobile browsers (no native app).            |
| ASM-008  | Timezone handling follows UTC for all server-side timestamps; frontend converts for display.  |
| ASM-009  | The application operates in English only.                                                    |

---

## 23. Out of Scope

Refer to Section 4.2 for the definitive list of out-of-scope items. Additionally:

| Item                                   | Rationale                                         |
| -------------------------------------- | ------------------------------------------------- |
| User profile management (avatar, bio)  | Not specified in requirements                     |
| Note export (PDF, Markdown, etc.)      | Not specified in requirements                     |
| Notification system                    | Not specified in requirements                     |
| Admin panel / user management          | Single-role system; no admin functionality needed |
| API versioning                         | Single version for MVP                            |
| Internationalization (i18n)            | English only per ASM-009                          |
| Database backups                       | Infrastructure concern, not application scope     |
| CI/CD pipeline                         | Development infrastructure, not app functionality |
| WebSocket / real-time features         | Explicitly excluded                               |

---

## 24. Glossary

| Term              | Definition                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Access Token      | A short-lived JWT (15 min) used to authenticate API requests.                               |
| Autosave          | Automatic saving of note content after a debounce period without explicit user action.       |
| Bcrypt            | A password hashing algorithm with configurable cost factor.                                 |
| CRUD              | Create, Read, Update, Delete — standard data operations.                                    |
| Full-Text Search  | PostgreSQL's built-in text search using `tsvector` and `tsquery` types.                     |
| Hard Delete       | Permanent removal of a record from the database.                                            |
| JWT               | JSON Web Token — a compact, URL-safe token for representing claims between parties.         |
| OTP               | One-Time Password — a 6-digit code used for password reset verification.                    |
| Pagination        | Returning results in fixed-size pages with metadata for navigation.                         |
| Refresh Token     | A long-lived token (7 days) stored in the database, used to obtain new access tokens.       |
| Rich Text         | Formatted text content supporting bold, italic, headings, lists, links, code blocks, etc.   |
| Share Link        | A unique, time-limited public URL that provides read-only access to a note.                 |
| Share Token       | A unique, unguessable identifier (UUID v4) embedded in a share link.                        |
| Soft Delete       | Marking a record as deleted by setting a `deletedAt` timestamp without removing the row.    |
| TipTap            | An open-source, headless rich-text editor framework built on ProseMirror.                   |
| Token Rotation    | The practice of invalidating a refresh token after use and issuing a new one.               |
| Version Snapshot  | An immutable copy of a note's title and content at a specific point in time.                |
| View Count        | The number of times a shared note has been accessed via its share link.                     |
| Zod               | A TypeScript-first schema validation library.                                               |

---

## 25. Requirement Traceability Matrix

This matrix maps every assignment ticket to its functional requirements, APIs, UX screens, and database entities.

### 25.1 Backend Tickets

| Ticket  | Description                        | Related Requirement IDs                        | Related APIs                                                                                  | Related Database Objects                      |
| ------- | ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| AB-1001 | Project Setup                      | —                                              | —                                                                                             | —                                             |
| AB-1002 | Backend Authentication             | FR-AUTH-001, FR-AUTH-002, FR-AUTH-003, FR-AUTH-004 | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` | `users`, `refresh_tokens`                     |
| AB-1003 | Backend Password Reset             | FR-PWD-001, FR-PWD-002, FR-PWD-003             | `POST /api/auth/forgot-password`, `POST /api/auth/verify-otp`, `POST /api/auth/reset-password` | `users`, `password_reset_otps`, `refresh_tokens` |
| AB-1004 | Backend Notes CRUD                 | FR-NOTE-001, FR-NOTE-002, FR-NOTE-003, FR-NOTE-004, FR-NOTE-005 | `POST /api/notes`, `GET /api/notes/:id`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`, `POST /api/notes/:id/restore` | `notes`, `note_tags`, `note_versions`, `share_links` |
| AB-1005 | Backend Notes List                 | FR-NOTE-006                                    | `GET /api/notes`                                                                              | `notes`, `note_tags`, `tags`                  |
| AB-1006 | Backend Tags                       | FR-TAG-001, FR-TAG-002, FR-TAG-003, FR-TAG-004 | `GET /api/tags`, `POST /api/tags`, `PATCH /api/tags/:id`, `DELETE /api/tags/:id`              | `tags`, `note_tags`                           |
| AB-1007 | Backend Search                     | FR-SRCH-001                                    | `GET /api/search`                                                                             | `notes` (searchVector, GIN index)             |
| AB-1008 | Backend Sharing                    | FR-SHARE-001, FR-SHARE-002, FR-SHARE-003, FR-SHARE-004 | `POST /api/notes/:id/share`, `DELETE /api/notes/:id/share`, `GET /api/shares`, `GET /api/shared/:token` | `share_links`, `notes`                        |
| AB-1009 | Backend Version History            | FR-VER-001, FR-VER-002, FR-VER-003, FR-VER-004, FR-VER-005 | `GET /api/notes/:id/versions`, `GET /api/notes/:id/versions/:versionNumber`, `POST /api/notes/:id/versions/:versionNumber/restore` | `note_versions`, `notes`                      |

### 25.2 Frontend Tickets

| Ticket  | Description                        | Related Requirement IDs                        | Related UX Screens                                                         |
| ------- | ---------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| AB-1010 | Frontend Authentication            | FR-AUTH-001, FR-AUTH-002, FR-AUTH-004, FR-PWD-001, FR-PWD-002, FR-PWD-003 | UX-SCR-001, UX-SCR-002, UX-SCR-003, UX-SCR-004, UX-SCR-005               |
| AB-1011 | Frontend Notes List                | FR-NOTE-006                                    | UX-SCR-006                                                                 |
| AB-1012 | Frontend Note Editor               | FR-NOTE-001, FR-NOTE-002, FR-NOTE-003, FR-NOTE-004 | UX-SCR-007, UX-SCR-008                                                     |
| AB-1013 | Frontend Search                    | FR-SRCH-001                                    | UX-SCR-009                                                                 |
| AB-1014 | Frontend Sharing                   | FR-SHARE-001, FR-SHARE-002, FR-SHARE-003       | UX-SCR-011, UX-SCR-013                                                     |
| AB-1015 | Frontend Version History           | FR-VER-001, FR-VER-002, FR-VER-003, FR-VER-004 | UX-SCR-012                                                                 |
| AB-1016 | End-to-End Journey                 | All FR-* requirements                          | All UX-SCR-* screens                                                       |

### 25.3 Per-Ticket Scope Definitions

Each ticket below defines its exact scope, dependencies, and acceptance criteria. These definitions are consumed by the `/spec` command during the SDD workflow to generate accurate proposals.

---

#### AB-1001 — Project Setup

**Description:** Initialize the monorepo, configure all developer tooling, set up the database, and create the AI development infrastructure.

**Dependencies:** None (first ticket).

**Scope — What to build:**

1. **Monorepo Initialization**
   - Initialize pnpm workspace with `pnpm-workspace.yaml`
   - Create `packages/shared/`, `apps/backend/`, `apps/frontend/` workspace packages
   - Create root `package.json` with workspace scripts
   - Create `tsconfig.base.json` with shared TypeScript strict settings
   - Each package gets its own `tsconfig.json` extending the base

2. **Backend Scaffolding**
   - Initialize Express 5 application (`app.ts`, `server.ts`)
   - Configure environment variable loading and validation (Zod)
   - Set up Prisma ORM with initial `schema.prisma` (all models from SDS Section 15)
   - Run initial Prisma migration to create all tables
   - Create raw SQL migration for `searchVector` column, GIN index, and trigger (SDS Section 24.3)
   - Create `.env.example` with all variables from SDS Section 7.2
   - Set up middleware stack: Helmet, CORS, JSON parser, request logger, rate limiter, error handler
   - Verify `pnpm dev:backend` starts without errors

3. **Frontend Scaffolding**
   - Initialize Vite + React 19 + TypeScript project
   - Install and configure Tailwind CSS + shadcn/ui
   - Set up React Router with route structure from SDS Section 8.2
   - Configure TanStack Query provider with settings from SDS Section 21.2
   - Create Zustand store shells (AuthStore, UIStore) from SDS Section 21.4
   - Create API client shell from SDS Section 22.1
   - Verify `pnpm dev:frontend` starts without errors

4. **Shared Package**
   - Create `packages/shared` with barrel exports
   - Set up Zod + TypeScript type infrastructure
   - Create all type files (stubs) from SDS Section 9.2
   - Create all schema files (stubs) from SDS Section 9.2
   - Create constants files (error codes from FRS Section 14, limits, defaults)
   - Verify package builds and is importable from both backend and frontend

5. **Database (Docker)**
   - Create `docker-compose.yml` with PostgreSQL 16 service
   - Configure volumes for data persistence
   - Create separate test database (`notetaking_test`)
   - Document database setup in README

6. **Developer Tooling**
   - Configure ESLint with TypeScript rules (`noImplicitAny`, strict mode)
   - Configure Prettier with consistent formatting
   - Set up Husky pre-commit hooks (lint + type-check + test)
   - Set up commitlint with conventional commit format (SDS Section 32.4)
   - Set up Vitest configuration for unit and integration tests
   - Configure Playwright for E2E tests
   - Verify `pnpm build`, `pnpm lint --max-warnings 0`, and `pnpm test` all pass

7. **AI Development Infrastructure**
   - Generate `AGENTS.md` at root (from FRS + SDS + codebase)
   - Generate root `CLAUDE.md` with quality gates, permission model, context management
   - Generate `apps/backend/CLAUDE.md` with backend-specific rules
   - Generate `apps/frontend/CLAUDE.md` with frontend-specific rules
   - Generate `packages/shared/CLAUDE.md` with shared package rules
   - Initialize OpenSpec (`openspec init`) and fill `openspec/project.md`
   - Create 7 slash commands in `.claude/commands/` (start, spec, plan, tasks, implement, review, pr)
   - Create 2 sub-agents in `.claude/agents/` (reviewer, test-writer)

**Acceptance Criteria:**
1. `pnpm install` completes without errors across all workspaces.
2. `pnpm build` produces zero TypeScript errors, zero warnings.
3. `pnpm lint --max-warnings 0` passes cleanly.
4. `pnpm test` runs (passes with no test files or placeholder tests).
5. `pnpm dev:backend` starts Express server on configured port.
6. `pnpm dev:frontend` starts Vite dev server.
7. `docker compose up -d` starts PostgreSQL and the database is accessible.
8. `pnpm db:migrate` runs Prisma migrations successfully, creating all tables.
9. `pnpm db:generate` generates Prisma client without errors.
10. All CLAUDE.md and AGENTS.md files exist and are readable.
11. OpenSpec is initialized with project context.
12. Husky pre-commit hook triggers on `git commit`.
13. commitlint rejects non-conventional commit messages.
14. All packages can import from `@note-app/shared` (or chosen package name).

---

#### AB-1002 — Backend Authentication

**Description:** Implement register, login, logout, token refresh, and get-me endpoints.

**Dependencies:** AB-1001 (project setup must be complete).

**Scope:**
- Implement all endpoints in SDS Section 17.1 (register, login, refresh, logout, me).
- Implement auth middleware for JWT verification.
- Implement bcrypt password hashing (cost factor ≥12).
- Implement refresh token rotation with database storage.
- Create Zod schemas in `packages/shared` for all auth request/response types.
- Write unit tests for auth service. Write integration tests for all auth endpoints.

**Acceptance Criteria:**
1. All FR-AUTH-001 through FR-AUTH-004 acceptance criteria pass.
2. All error codes from FRS Section 14.1 are returned correctly.
3. Tokens have correct expiry times (access: 15min, refresh: 7 days).
4. Refresh token rotation works (old token invalidated after use).
5. `pnpm build && pnpm lint --max-warnings 0 && pnpm test` all pass with ≥80% coverage on new code.

---

#### AB-1003 — Backend Password Reset (OTP)

**Description:** Implement forgot-password, verify-otp, and reset-password endpoints.

**Dependencies:** AB-1002 (auth infrastructure must exist).

**Scope:**
- Implement all OTP/reset endpoints in SDS Section 17.1.
- Implement OTP generation (6-digit, cryptographically random).
- Hash OTPs with SHA-256 before storage. 10-minute expiry.
- Implement password reset token generation (15-minute expiry).
- Implement rate limiting on OTP endpoints (FRS Section 14.2).
- Invalidate all refresh tokens on password reset.
- Log simulated email to console (SDS Section 29.4 format).

**Acceptance Criteria:**
1. All FR-PWD-001 through FR-PWD-003 acceptance criteria pass.
2. All error codes from FRS Section 14.2 are returned correctly.
3. OTP is logged to console in the formatted email block.
4. Rate limiting enforced per FRS.
5. Quality gates pass.

---

#### AB-1004 — Backend Notes CRUD + Soft Delete

**Description:** Implement create, read, update, soft-delete, and restore endpoints for notes.

**Dependencies:** AB-1002 (auth middleware required).

**Scope:**
- Implement all note CRUD endpoints in SDS Section 17.2 (except list — that's AB-1005).
- Implement soft delete via `deletedAt` timestamp (SDS Section 27).
- Create initial version snapshot on note create (FR-VER-001 — preparation for AB-1009).
- Create version snapshot on note update.
- Revoke share links on soft delete (BR-014).
- Extract plain text from HTML content for search vector.
- Create Zod schemas in `packages/shared` for all note types.

**Acceptance Criteria:**
1. All FR-NOTE-001 through FR-NOTE-005 acceptance criteria pass.
2. All error codes from FRS Section 14.3 are returned correctly.
3. Version snapshots are created on every create/update.
4. Soft delete revokes active share links.
5. Quality gates pass.

---

#### AB-1005 — Backend Notes List (Pagination, Sorting, Filtering)

**Description:** Implement the paginated, sortable, filterable notes list endpoint.

**Dependencies:** AB-1004 (notes must exist), AB-1006 can be done in parallel for tag filtering.

**Scope:**
- Implement `GET /api/notes` with pagination, sorting, and tag filtering (SDS Section 17.2).
- Implement pagination metadata response (SDS Section 18.2).
- Support sort by: `createdAt`, `updatedAt`, `title` in `asc`/`desc`.
- Support tag filtering with AND logic.
- Exclude soft-deleted notes by default; support `includeTrashed` param.

**Acceptance Criteria:**
1. All FR-NOTE-006 acceptance criteria pass.
2. Default pagination (page 1, size 20) works.
3. Sorting by all three fields works in both directions.
4. Tag filtering with AND logic works.
5. Quality gates pass.

---

#### AB-1006 — Backend Tags CRUD + Note Counts

**Description:** Implement full CRUD for user-scoped tags with note count aggregation.

**Dependencies:** AB-1004 (notes must exist for tag associations).

**Scope:**
- Implement all tag endpoints in SDS Section 17.3.
- Enforce case-insensitive uniqueness per user.
- Return note count (non-deleted notes) with each tag.
- Cascade delete: removing a tag removes all NoteTag associations.
- Create Zod schemas in `packages/shared` for tag types.

**Acceptance Criteria:**
1. All FR-TAG-001 through FR-TAG-004 acceptance criteria pass.
2. All error codes from FRS Section 14.4 are returned correctly.
3. Note counts exclude soft-deleted notes.
4. Quality gates pass.

---

#### AB-1007 — Backend Full-Text Search

**Description:** Implement PostgreSQL full-text search with ranking and highlighting.

**Dependencies:** AB-1004 (notes must exist with search vectors).

**Scope:**
- Implement `GET /api/search` endpoint (SDS Section 17.4).
- Use `plainto_tsquery` for query parsing.
- Use `ts_rank` for relevance scoring (SDS Section 24.4).
- Use `ts_headline` for keyword highlighting with `<mark>` tags (SDS Section 24.4).
- Support pagination on search results.
- Filter to user's non-deleted notes only.
- Support optional tag filtering (AND with search).

**Acceptance Criteria:**
1. All FR-SRCH-001 acceptance criteria pass.
2. Search covers both title and content.
3. Results include highlighted snippets with `<mark>` tags.
4. Results are sorted by relevance.
5. Stemming works (e.g., searching "running" finds "run").
6. Quality gates pass.

---

#### AB-1008 — Backend Sharing

**Description:** Implement share link generation, revocation, public access, and atomic view counting.

**Dependencies:** AB-1004 (notes must exist).

**Scope:**
- Implement all share endpoints in SDS Section 17.5.
- Generate UUID v4 share tokens (SDS Section 25.1).
- Implement atomic view count increment (SDS Section 25.3).
- Public endpoint returns read-only note (no email, tags, versions, or note ID).
- Enforce one active share link per note.
- Configurable expiry (1h–30d, default 7d).

**Acceptance Criteria:**
1. All FR-SHARE-001 through FR-SHARE-004 acceptance criteria pass.
2. All error codes from FRS Section 14.5 are returned correctly.
3. View count increments atomically under concurrent access.
4. Expired links return 410.
5. Quality gates pass.

---

#### AB-1009 — Backend Version History

**Description:** Implement version listing, viewing, restoring, and auto-purge.

**Dependencies:** AB-1004 (version snapshots created during note CRUD).

**Scope:**
- Implement all version endpoints in SDS Section 17.6.
- Version list returns newest-first with content preview (first 200 chars).
- Version view returns full content.
- Restore creates a NEW version (does not rewrite history) per SDS Section 26.3.
- Implement auto-purge logic (90 days, retain 10 minimum) per SDS Section 26.4.

**Acceptance Criteria:**
1. All FR-VER-001 through FR-VER-005 acceptance criteria pass.
2. All error codes from FRS Section 14.6 are returned correctly.
3. Restoring a version creates a new version record.
4. Auto-purge retains minimum 10 versions per note.
5. Quality gates pass.

---

#### AB-1010 — Frontend Authentication Pages

**Description:** Build all auth UI screens: register, login, forgot password, OTP verification, reset password.

**Dependencies:** AB-1002, AB-1003 (backend auth APIs must be ready).

**Scope:**
- Build screens UX-SCR-001 through UX-SCR-005 per UX Section 8.1–8.5.
- Implement all validation messages from UX Section 14.1, 14.2, 14.7.
- Implement user flows from UX Sections 7.1, 7.2, 7.3.
- Connect to backend auth APIs via API client.
- Store tokens in Zustand auth store.
- Implement automatic token refresh (SDS Section 11.3).
- Implement protected route wrapper (redirect to `/login` if not authenticated).

**Acceptance Criteria:**
1. All UX-AUTH-01 through UX-AUTH-06 acceptance criteria pass (UX Section 22.1).
2. All forms show real-time validation with correct messages.
3. OTP input supports paste and auto-advance.
4. Token refresh works silently in the background.
5. Quality gates pass.

---

#### AB-1011 — Frontend Notes List Page

**Description:** Build the dashboard page with sidebar, tag filter, note cards, sorting, and pagination.

**Dependencies:** AB-1005 (backend notes list API), AB-1006 (backend tags API), AB-1010 (auth pages for protected routing).

**Scope:**
- Build screen UX-SCR-006 per UX Section 8.6.
- Implement sidebar with tag list and note counts.
- Implement note cards with title, preview, tags, timestamp.
- Implement sort dropdown (createdAt, updatedAt, title × asc/desc).
- Implement pagination controls.
- Implement trash view toggle.
- Implement empty states from UX Section 10.
- Implement shimmer loading states from UX Section 11.

**Acceptance Criteria:**
1. All UX-NOTE-05, UX-NOTE-07 acceptance criteria pass.
2. Tag filtering works with sidebar tag chips.
3. Sorting and pagination work correctly.
4. Empty state displays when no notes exist.
5. Quality gates pass.

---

#### AB-1012 — Frontend Note Editor with TipTap + Autosave

**Description:** Build the rich-text note editor with TipTap, autosave, tag management, and delete confirmation.

**Dependencies:** AB-1004 (backend notes CRUD), AB-1006 (backend tags), AB-1011 (notes list for navigation).

**Scope:**
- Build screens UX-SCR-007 and UX-SCR-008 per UX Sections 8.7–8.8.
- Configure TipTap editor with all extensions from SDS Section 23.1.
- Implement autosave with 2-second debounce (SDS Section 23.3).
- Implement "Saving..." → "Saved ✓" indicator.
- Implement tag bar with add/remove functionality.
- Implement inline tag creation (create tag without opening modal).
- Implement delete confirmation dialog.
- Implement `beforeunload` warning for unsaved changes.
- Implement all editor keyboard shortcuts from UX Section 15.2.

**Acceptance Criteria:**
1. All UX-NOTE-01 through UX-NOTE-06 acceptance criteria pass (UX Section 22.2).
2. Autosave triggers after 2s of inactivity.
3. All TipTap formatting options work (bold, italic, lists, code, etc.).
4. Delete confirmation defaults focus to "Cancel".
5. Quality gates pass.

---

#### AB-1013 — Frontend Search UI

**Description:** Build the search interface with debounced input and highlighted results.

**Dependencies:** AB-1007 (backend search API), AB-1011 (dashboard layout).

**Scope:**
- Build screen UX-SCR-009 per UX Section 8.9.
- Implement search bar with 300ms debounce (UX-SRCH-01).
- Render search results with `<mark>` highlighted snippets (UX-SRCH-02).
- Implement keyboard navigation (Ctrl+K to focus, Escape to clear).
- Implement empty search state from UX Section 10.
- Announce result count via `aria-live` (UX-SRCH-03).

**Acceptance Criteria:**
1. All UX-SRCH-01 through UX-SRCH-04 acceptance criteria pass (UX Section 22.4).
2. Search is debounced at 300ms.
3. Highlighted snippets render correctly.
4. Quality gates pass.

---

#### AB-1014 — Frontend Share Modal + Public View

**Description:** Build the share modal (generate/copy/revoke) and the public shared note view.

**Dependencies:** AB-1008 (backend sharing API), AB-1012 (editor for share button trigger).

**Scope:**
- Build screens UX-SCR-011 and UX-SCR-013 per UX Sections 8.11, 8.13.
- Implement user flow from UX Section 7.8.
- Implement expiry dropdown (1h to 30d).
- Implement "Copy Link" → "Copied! ✓" feedback.
- Implement "Revoke Link" with confirmation.
- Build public shared note view (read-only, no auth required).
- Build expired/not-found error pages for shared view.
- Show view count in share modal.

**Acceptance Criteria:**
1. All UX-SHARE-01 through UX-SHARE-04 acceptance criteria pass (UX Section 22.5).
2. Copy to clipboard works and shows visual feedback.
3. Public view does not expose email, tags, version history, or note ID.
4. Expired links show appropriate error page.
5. Quality gates pass.

---

#### AB-1015 — Frontend Version History Drawer + Restore

**Description:** Build the version history slide-over drawer with preview and restore functionality.

**Dependencies:** AB-1009 (backend version API), AB-1012 (editor for history button trigger).

**Scope:**
- Build screen UX-SCR-012 per UX Section 8.12.
- Implement user flow from UX Section 7.9.
- Implement slide-over drawer (300ms animation from right).
- Implement version list (newest first, preview snippet).
- Implement version preview with yellow banner.
- Implement "Restore this version" button with toast confirmation.
- Focus management: focus trap in drawer, return focus on close.

**Acceptance Criteria:**
1. All UX-VER-01 through UX-VER-04 acceptance criteria pass (UX Section 22.6).
2. Drawer animates in/out correctly.
3. Previewing a version shows the yellow banner.
4. Restoring creates a new version (no data loss).
5. Quality gates pass.

---

#### AB-1016 — End-to-End Journey (Playwright)

**Description:** Write a complete Playwright E2E test covering the full user journey across all features.

**Dependencies:** AB-1010 through AB-1015 (all frontend tickets complete).

**Scope:**
- Write E2E tests in `apps/frontend/tests/e2e/`.
- Cover the complete user journey:
  1. Register a new account → verify redirect to login.
  2. Login → verify redirect to dashboard.
  3. Create a note with title and rich-text content → verify autosave.
  4. Create tags and assign to note → verify tag chips appear.
  5. Search for the note → verify highlighted results.
  6. Generate a share link → verify copy. Open shared URL → verify public view.
  7. View version history → verify version list. Restore a version → verify new version.
  8. Soft-delete the note → verify trash. Restore from trash.
  9. Revoke share link → verify expired access.
  10. Logout → verify redirect to login.
- Run against a test database (clean state per run).

**Acceptance Criteria:**
1. `pnpm test:e2e` passes the entire journey.
2. Every major feature is exercised (auth, CRUD, tags, search, share, versions).
3. Happy path + at least 3 error scenarios are tested.
4. Test runs in CI-compatible headless mode.
5. Quality gates pass.

---

*End of Functional Requirements Specification*
