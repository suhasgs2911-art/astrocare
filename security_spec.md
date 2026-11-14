# Firestore Security Specification

## 1. Data Invariants
1. Operator PII (`email`) is strictly isolated under `/users/{userId}/private/info` and readable/writable only by `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. Public operator metadata (`callsign`, `displayName`, `roleTitle`) resides under `/users/{userId}/public/profile` and cannot contain shadow fields or PII.
3. Telemetry action logs under `/users/{userId}/telemetryActions/{actionId}` must match `ownerUid == request.auth.uid`, enforce bounded string lengths, and use server timestamps (`request.time`).
4. Every path variable `{userId}` and `{actionId}` is constrained via `isValidId()`.
5. Default-deny catch-all rule blocks all unlisted paths.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/u1/private/info`.
2. Unauthenticated write on `/users/u1/telemetryActions/act1`.
3. Cross-user read of `/users/u2/private/info` by `u1`.
4. Cross-user write to `/users/u2/public/profile` by `u1`.
5. Unverified email user (`email_verified: false`) attempting create on `/users/u1/private/info`.
6. Shadow field injection (`{ ..., isAdmin: true }`) on `/users/u1/public/profile`.
7. Spoofed `ownerUid: "u2"` inside `/users/u1/telemetryActions/act1`.
8. Oversized 2KB `summary` string on `/users/u1/telemetryActions/act1`.
9. Client-forged `createdAt` timestamp not equal to `request.time`.
10. Invalid `actionType: "DROP_ALL"` outside allowlist enum.
11. Malformed `callsign` containing spaces/lowercase violating `^[A-Z0-9\\-]+$`.
12. Mutation of immutable `ownerUid` or `createdAt` during update on `/users/u1/telemetryActions/act1`.
