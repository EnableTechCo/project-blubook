# Dashboard DRY Refactor TODO

Status legend:

- [ ] Not started
- [~] In progress
- [x] Done

## Phase 1: Cross-dashboard primitives

- [x] 1. MetricsCardGrid - config-driven grid of metric cards with title/description clamp and loading fallback.
- [x] 2. DashboardPageHeader - title, subtitle, and right-side badge/count shell.
- [x] 3. WorkflowOpsSectionShell - highlighted operations section wrapper with heading/subtext/errors.
- [x] 4. InlineErrorMessage - shared inline error message block with tone variants.
- [x] 5. EntityHeaderRow - reusable item row with title/subtitle + status/action area.
- [x] 6. StepStateChipsRow - dynamic done/active/upcoming chip row.
- [x] 7. SequencedActionHint - standard sequence guidance helper text block.
- [x] 8. WorkflowProgressPanel - standardized wrapper around WorkflowProgress.
- [x] 9. AdditionalItemsPillList - reusable "Other Active" pill list.
- [x] 10. EmptyStateNoticeCard - generic icon/title/body empty state card.
- [x] 11. RealtimeStatusDot - live/stale/waiting status indicator.
- [x] 12. QuickLinksActionBar - route link button row for dashboard quick actions.
- [x] 13. DocumentUploadField - single upload row (label/help/uploader/file name).
- [x] 14. DualDocumentUploadModal - two-file completion modal shell.
- [x] 15. ActionButtonWithLoading - consistent button with loading and disabled handling.

## Phase 2: Customer dashboard decomposition

- [x] 16. useCustomerDashboardData - consolidate customer data queries and realtime invalidation.
- [x] 17. usePurchaseOrderUploadFlow - upload state machine and timing lifecycle.
- [x] 18. CustomerWorkflowPanelContainer - routing for loading/error/upload/tracking/idle views.
- [x] 19. UploadFlowProgressRail - stage rail with marker states and progress fill.
- [x] 20. UploadFlowStepCards - interactive step cards with status and timing badges.
- [x] 21. UploadFlowStepDetailsCard - selected step detail panel.
- [x] 22. ActiveOrderTrackingCard - current order summary, actions, and progress composition.
- [x] 23. CurrentOwnerPill - owner + next hint capsule.
- [x] 24. NoActiveOrderCtaPanel - no-order icon panel and upload CTA.
- [x] 25. RetractOrderDialog - shared retract confirmation dialog wrapper.
- [x] 26. StatusToOwnerMap utility - shared status-to-owner label mapper.
- [x] 27. RequirementFilters utility - reusable purchase-order requirement predicates.

## Phase 3: Partner dashboard decomposition

- [x] 28. usePartnerDashboardData - fetch/normalize payload and realtime refresh handling.
- [x] 29. usePartnerDashboardActions - package all mutation/action handlers.
- [x] 30. PartnerAlertsPanel - grouped partner error and warning messages.
- [x] 31. PurchaseOrdersOperationsSection - PO operations shell with heading/counters.
- [x] 32. PurchaseOrderCard - single PO card composition.
- [x] 33. PurchaseOrderReviewPanel - PO evidence review + decision controls.
- [x] 34. EvidenceFileRow - file row with timestamp/view state.
- [x] 35. SalesControlActionsPanel - sales control chips + action strip.
- [x] 36. LogisticsWorkOrdersSection - logistics section shell.
- [x] 37. LogisticsWorkOrderCard - single logistics card composition.
- [x] 38. PartnerRequestPingCard - incoming request ping card.
- [x] 39. PartnerRequestQueueItem - accepted queue row item.
- [x] 40. LogisticsWorkOrdersCtaCard - logistics CTA card wrapper.
- [x] 41. WorkflowSnapshotBuilder utility - shared snapshot and status-label helpers.
- [x] 42. PartnerDashboardConsoleDiagnostics utility - isolated dev diagnostics logger.

## Guardrails

- [x] A. Every extraction must be behavior-preserving and API-compatible.
- [x] B. Add or update tests when extracting behavior-heavy logic.
- [x] C. Run type/error checks after each extraction batch.
- [x] D. Keep refactors incremental: max 2-4 items per PR.
