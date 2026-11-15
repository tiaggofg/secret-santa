# secret-santa proofs

**HEAD**: 288f186
**Tree**: clean
**Shell**: /bin/sh
**Result**: 39 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C2 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C3 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C4 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C5 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C6 | `run backend / GroupPublicControllerIT` | pass |
| C7 | `run frontend / BrowserGeolocationService` | pass |
| C8 | `run backend / GroupPublicControllerIT` | pass |
| C9 | `run frontend / HomeGroupsPageComponent` | pass |
| C10 | `run frontend / PublicGroupPageComponent` | pass |
| C11 | `run backend / GroupPublicControllerIT` | pass |
| C12 | `run frontend / HomeGroupsPageComponent` | pass |
| C13 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C14 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C15 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C16 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C17 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C18 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C19 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C20 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C21 | `run frontend / BrowserGeolocationService` | pass |
| C22 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C23 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C24 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C25 | `run backend / HouseholdClusterServiceTest` | pass |
| C26 | `run backend / HouseholdClusterServiceTest` | pass |
| C27 | `run backend / DerangementDrawServiceTest` | pass |
| C28 | `run backend / DerangementDrawServiceTest` | pass |
| C29 | `run frontend / PublicGroupPageComponent` | pass |
| C30 | `run backend / GroupPublicControllerIT` | pass |
| C31 | `run backend / GroupPublicControllerIT` | pass |
| C32 | `run backend / GroupPublicControllerIT` | pass |
| C33 | `run frontend / EphemeralRevealModalComponent` | pass |
| C34 | `run frontend / EphemeralRevealModalComponent` | pass |
| C35 | `run frontend / EphemeralRevealModalComponent` | pass |
| C36 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| C37 | `run backend / GroupAdminAndAuthControllerIT` | pass |
| Build | `test ! -f backend/pom.xml // JAVA_HOME=/usr/lib/jvm/jdk-25.0.4.1+1 mvn -f backend/pom.xml test-compile` | pass |
| Build | `test ! -f frontend/package.json // npm --prefix frontend run build` | pass |

## Output

`Run backend` - exit 0

```
[INFO] ------------------------------------------------------------------------
WARNING: A terminally deprecated method in sun.misc.Unsafe has been called
WARNING: sun.misc.Unsafe::objectFieldOffset has been called by com.google.common.util.concurrent.AbstractFuture$UnsafeAtomicHelper (file:/usr/share/maven/lib/guava.jar)
WARNING: Please consider reporting this to the maintainers of class com.google.common.util.concurrent.AbstractFuture$UnsafeAtomicHelper
WARNING: sun.misc.Unsafe::objectFieldOffset will be removed in a future release
WARNING: A terminally deprecated method in sun.misc.Unsafe has been called
WARNING: sun.misc.Unsafe::allocateMemory has been called by io.netty.util.internal.PlatformDependent0$2 (file:/home/tiago.godoy@db1.com.br/.m2/repository/io/netty/netty-common/4.1.135.Final/netty-common-4.1.135.Final.jar)
WARNING: Please consider reporting this to the maintainers of class io.netty.util.internal.PlatformDependent0$2
WARNING: sun.misc.Unsafe::allocateMemory will be removed in a future release
Mockito is currently self-attaching to enable the inline-mock-maker. This will no longer work in future releases of the JDK. Please add Mockito as an agent to your build as described in Mockito's documentation: https://javadoc.io/doc/org.mockito/mockito-core/latest/org.mockito/org/mockito/Mockito.html#0.3
WARNING: A Java agent has been loaded dynamically (/home/tiago.godoy@db1.com.br/.m2/repository/net/bytebuddy/byte-buddy-agent/1.17.8/byte-buddy-agent-1.17.8.jar)
WARNING: If a serviceability tool is in use, please run with -XX:+EnableDynamicAgentLoading to hide this warning
WARNING: If a serviceability tool is not in use, please run with -Djdk.instrument.traceUsage for more information
WARNING: Dynamic loading of agents will be disallowed by default in a future release
OpenJDK 64-Bit Server VM warning: Sharing is only supported for boot loader classes because bootstrap classpath has been appended
```

`Run frontend` - exit 0

```
 ✓ src/app/features/home/home-groups-page.component.spec.ts > HomeGroupsPageComponent > joins an available group with 1 tap using GPS coordinates when granted 39ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > allows an unauthenticated visitor arriving via WhatsApp link /g/:slug while OPEN to register and automatically join the group (C10) 540ms
 ✓ src/app/features/home/home-groups-page.component.spec.ts > HomeGroupsPageComponent > completes group join with latitude=null and longitude=null and displays non-blocking notice when GPS is denied or times out (C9) 57ms
 ✓ src/app/features/home/home-groups-page.component.spec.ts > HomeGroupsPageComponent > creates a new group when authenticated user submits eventName 39ms
 ✓ src/app/features/home/home-groups-page.component.spec.ts > HomeGroupsPageComponent > clears AuthSessionStore in memory while preserving DeviceSessionGeoStore when clicking switch family user button (C12) 40ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > allows switching family user on /g/:slug after joining to register a dependent on the same phone reusing DeviceSessionGeoStore 53ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > displays reveal form and participant list when DRAWN, pre-filling username when clicking a participant item (C29) 40ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > reveals Secret Santa match with valid username + PIN, clears PIN input, and opens EphemeralRevealModalComponent 45ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > clears PIN field and shows error message when reveal fails with HTTP 401 invalid PIN 41ms
 ✓ src/app/features/public-group/public-group-page.component.spec.ts > PublicGroupPageComponent > allows an already authenticated user who opens /g/:slug while OPEN to join with 1 tap 35ms

 Test Files  7 passed (7)
      Tests  39 passed (39)
   Start at  23:24:22
   Duration  6.68s (transform 3.84s, setup 17.90s, collect 3.71s, tests 2.99s, environment 8.33s, prepare 10.72s)
```
