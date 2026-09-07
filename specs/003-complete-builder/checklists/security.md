# Security Requirements Checklist

- [x] CHK001 - Is the first-Owner bootstrap identity fixed and race-safe? [Clarity, FR-003]
- [x] CHK002 - Are authentication and authorization separate on every protected request? [Completeness, FR-001, FR-005, FR-008]
- [x] CHK003 - Are pending, disabled, revoked, and last-Owner cases specified? [Coverage, FR-004, FR-007, FR-010]
- [x] CHK004 - Are CSRF, origin, body, validation, idempotency, and rate-limit controls explicit? [Completeness, FR-036]
- [x] CHK005 - Are secret, error, audit, private-content, and public-content boundaries explicit? [Coverage, FR-037, FR-038, FR-042]
- [x] CHK006 - Are release signing and private-key boundaries explicit? [Clarity, FR-028, FR-032]
- [x] CHK007 - Does organization-wide GitHub App use preserve the existing permission set? [Least privilege, FR-002]
