# secret-santa verification

**Verdict**: PASS
**Proofs**: `proofs.md` at 288f186
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRegisterValidUserAccountAndReturn201WithStatelessToken_C1` | yes |
| C2 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRejectInvalidRegisterPayloadsWith400_C2` | yes |
| C3 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRejectDuplicateUsernameCaseInsensitivelyWith409_C3` | yes |
| C4 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldLoginValidUserAndReturn200WithToken_C4` | yes |
| C5 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRejectLoginWithUnknownUserOrWrongPinWith401_C5` | yes |
| C6 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldListMyGroupsAndAvailableOpenGroupsForAuthenticatedUser_C6` | yes |
| C7 | `frontend/src/app/core/geolocation/browser-geolocation.service.spec.ts` `requests navigator.geolocation.getCurrentPosition with 8000ms timeout and returns valid coordinates when granted` | yes |
| C8 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldJoinOpenGroupWithValidGeolocationAndReturn201_C8` | yes |
| C9 | `frontend/src/app/features/home/home-groups-page.component.spec.ts` `completes group join with latitude=null and longitude=null and displays non-blocking notice when GPS is denied or times out (C9)` | yes |
| C10 | `frontend/src/app/features/public-group/public-group-page.component.spec.ts` `allows an unauthenticated visitor arriving via WhatsApp link /g/:slug while OPEN to register and automatically join the group (C10)` | yes |
| C11 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldRejectDuplicateRegistrationOrJoiningAlreadyDrawnGroupWith409_C11` | yes |
| C12 | `frontend/src/app/features/home/home-groups-page.component.spec.ts` `clears AuthSessionStore in memory while preserving DeviceSessionGeoStore when clicking switch family user button (C12)` | yes |
| C13 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldCreateGroupSettingOrganizerUserIdAndReturn201WithSharePath_C13` | yes |
| C14 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRejectGroupCreationWithShortOrInvalidEventNameWith400_C14` | yes |
| C15 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldReturnAdminGroupWithParticipantsAndNeverExposeSecretFields_C15_C16` | yes |
| C16 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldReturnAdminGroupWithParticipantsAndNeverExposeSecretFields_C15_C16` | yes |
| C17 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRemoveParticipantWhileOpenWith204AndRejectWhenDrawnWith409_C17_C18` | yes |
| C18 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRemoveParticipantWhileOpenWith204AndRejectWhenDrawnWith409_C17_C18` | yes |
| C19 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldRejectAdminEndpointsWith401WhenUnauthenticatedAnd403WhenNotOrganizer_C19` | yes |
| C20 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldGenerateOneTimeResetTokenWith200AndResetPinConsumingToken_C20_C36_C37` | yes |
| C21 | `frontend/src/app/core/geolocation/browser-geolocation.service.spec.ts` `invokes navigator.share when supported or falls back to navigator.clipboard.writeText for group and reset links` | yes |
| C22 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldExecuteDrawWith200RejectFewerThanThreeWith422AndRejectAlreadyDrawnWith409_C22_C23_C24` | yes |
| C23 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldExecuteDrawWith200RejectFewerThanThreeWith422AndRejectAlreadyDrawnWith409_C22_C23_C24` | yes |
| C24 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldExecuteDrawWith200RejectFewerThanThreeWith422AndRejectAlreadyDrawnWith409_C22_C23_C24` | yes |
| C25 | `backend/src/test/java/com/secretsanta/domain/service/HouseholdClusterServiceTest.java` `shouldApplyTransitiveClosureViaUnionFindWhenChainedWithin50Meters` | yes |
| C26 | `backend/src/test/java/com/secretsanta/domain/service/HouseholdClusterServiceTest.java` `shouldAssignUniqueIsolatedClusterToEachParticipantWithNullCoordinates` | yes |
| C27 | `backend/src/test/java/com/secretsanta/domain/service/DerangementDrawServiceTest.java` `shouldGenerateStrictInterHouseholdDerangementWhenMaxClusterIsAtMostHalfN` | yes |
| C28 | `backend/src/test/java/com/secretsanta/domain/service/DerangementDrawServiceTest.java` `shouldTriggerAutomaticFallbackMinimizingIntraHouseholdCollisionsWhenHallConditionViolated` | yes |
| C29 | `frontend/src/app/features/public-group/public-group-page.component.spec.ts` `displays reveal form and participant list when DRAWN, pre-filling username when clicking a participant item (C29)` | yes |
| C30 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldRevealDrawnMatchWithValidUsernameAndPinAndMarkRevealed_C30` | yes |
| C31 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldRejectRevealWithWrongPinOrNonMemberUsernameWith401_C31` | yes |
| C32 | `backend/src/test/java/com/secretsanta/web/GroupPublicControllerIT.java` `shouldRejectRevealWhenGroupIsStillOpenWith409_C32` | yes |
| C33 | `frontend/src/app/features/public-group/ephemeral-reveal-modal.component.spec.ts` `displays drawnParticipantName in a high-contrast card with button "Fechar e passar o celular" (C33)` | yes |
| C34 | `frontend/src/app/features/public-group/ephemeral-reveal-modal.component.spec.ts` `wipes drawnName Signal to null and destroys DOM when document visibilityState changes to hidden (C34)` | yes |
| C35 | `frontend/src/app/features/public-group/ephemeral-reveal-modal.component.spec.ts` `never writes drawnParticipantName or PIN to localStorage, sessionStorage, cookies or URL (C35)` | yes |
| C36 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldGenerateOneTimeResetTokenWith200AndResetPinConsumingToken_C20_C36_C37` | yes |
| C37 | `backend/src/test/java/com/secretsanta/web/GroupAdminAndAuthControllerIT.java` `shouldGenerateOneTimeResetTokenWith200AndResetPinConsumingToken_C20_C36_C37` | yes |

## Findings

None - Probed 5-node Haversine 49.9m transitive Union-Find chain (~199.6m total span) with 50.1m boundary isolation and 2 null-coordinate singleton clusters (N=8, max_cluster=5 > floor(8/2)=4 achieving exact minimum of 2 intra-household collisions across 50 runs), odd-N Hall boundary (N=9, clusters [4,3,2], 0 collisions across 100 runs), and reset token overwrite/expiration boundary/single-use invalidation.
