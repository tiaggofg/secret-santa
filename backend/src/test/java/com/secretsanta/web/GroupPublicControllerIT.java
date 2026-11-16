package com.secretsanta.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.AdminGroupView;
import com.secretsanta.application.SecretSantaApplicationService.AuthSessionView;
import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.infrastructure.persistence.SecretSantaGroupDocument;
import com.secretsanta.infrastructure.persistence.SecretSantaIndexesChangeUnit;
import com.secretsanta.infrastructure.persistence.RefreshTokenDocument;
import com.secretsanta.infrastructure.persistence.UserAccountDocument;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ContextConfiguration(initializers = MongoTestContainerConfig.class)
class GroupPublicControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SecretSantaApplicationService applicationService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private SecretSantaIndexesChangeUnit indexesChangeUnit;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(UserAccountDocument.class);
        mongoTemplate.dropCollection(RefreshTokenDocument.class);
        mongoTemplate.dropCollection(SecretSantaGroupDocument.class);
        indexesChangeUnit.ensureIndexes();
    }

    private static Cookie accessCookie(AuthSessionView session) {
        return new Cookie(AuthCookieManager.ACCESS_TOKEN_COOKIE, session.token());
    }

    private static String extractSig(AdminGroupView group) {
        String sharePath = group.sharePath();
        int idx = sharePath.indexOf("?sig=");
        assertThat(idx).isGreaterThan(0);
        return sharePath.substring(idx + 5);
    }

    @Test
    void shouldListOnlyMyGroupsForAuthenticatedUser() throws Exception {
        var userA = applicationService.registerUser("User A", "user.a", "Ab1!cd");
        var userB = applicationService.registerUser("User B", "user.b", "Ab1!cd");

        var myGroup = applicationService.createGroup(userA.userId(), "Grupo do User A");
        applicationService.registerParticipant(myGroup.id(), userA.userId(), null, -23.42, -51.93);

        applicationService.createGroup(userB.userId(), "Grupo Privado B");

        mockMvc.perform(get("/api/v1/groups")
                        .cookie(accessCookie(userA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myGroups.length()").value(1))
                .andExpect(jsonPath("$.myGroups[0].id").value(myGroup.id().toString()))
                .andExpect(jsonPath("$.myGroups[0].sharePath").value("/g/" + myGroup.id()))
                .andExpect(jsonPath("$.myGroups[0].organizer").value(true))
                .andExpect(jsonPath("$.myGroups[0].joined").value(true))
                .andExpect(jsonPath("$.availableGroups").doesNotExist());
    }

    @Test
    void shouldHideParticipantsForNonMembersValidateInviteSignatureAndReturn404ForInvalidUuid() throws Exception {
        var org = applicationService.registerUser("Org", "org.pub", "Ab1!cd");
        var member = applicationService.registerUser("Membro", "membro.pub", "Bb2@cc");
        var outsider = applicationService.registerUser("Visitante", "outsider.pub", "Cc3#dd");

        var group = applicationService.createGroup(org.userId(), "Natal Privado");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), member.userId(), sig, -23.42, -51.93);

        // Anonymous visitor without sig -> inviteValid: false, participantsVisible: false, participants: []
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(group.id().toString()))
                .andExpect(jsonPath("$.eventName").value("Natal Privado"))
                .andExpect(jsonPath("$.inviteValid").value(false))
                .andExpect(jsonPath("$.participantCount").value(1))
                .andExpect(jsonPath("$.participantsVisible").value(false))
                .andExpect(jsonPath("$.participants.length()").value(0));

        // Anonymous visitor with valid sig -> inviteValid: true, participantsVisible: false
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .param("sig", sig))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inviteValid").value(true))
                .andExpect(jsonPath("$.participantsVisible").value(false))
                .andExpect(jsonPath("$.participants.length()").value(0));

        // Authenticated non-member without sig -> inviteValid: false, participantsVisible: false
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .cookie(accessCookie(outsider)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inviteValid").value(false))
                .andExpect(jsonPath("$.participantsVisible").value(false))
                .andExpect(jsonPath("$.participants.length()").value(0));

        // Member without sig -> inviteValid: true, participantsVisible: true with full participants list
        MvcResult res = mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .cookie(accessCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(group.id().toString()))
                .andExpect(jsonPath("$.eventName").value("Natal Privado"))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.organizer").value(false))
                .andExpect(jsonPath("$.inviteValid").value(true))
                .andExpect(jsonPath("$.participantsVisible").value(true))
                .andExpect(jsonPath("$.participantCount").value(1))
                .andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.participants[0].username").value("membro.pub"))
                .andReturn();

        assertThat(res.getResponse().getContentAsString())
                .doesNotContain("drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash", "inviteSignature", sig);

        // Invalid UUID -> 404
        mockMvc.perform(get("/api/v1/groups/{groupId}", "not-a-uuid"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldJoinOpenGroupWithValidInviteSignatureAndRejectInvalidSignatureWith403() throws Exception {
        var org = applicationService.registerUser("Org", "org.join", "Ab1!cd");
        var participant = applicationService.registerUser("Pedro", "pedro.silva", "Dd4$ee");
        var group = applicationService.createGroup(org.userId(), "Natal GPS");
        String sig = extractSig(group);

        // Wrong or missing inviteSignature -> 403 INVALID_INVITE_SIGNATURE
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(participant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "inviteSignature", "invalid-sig-0000",
                                "latitude", -23.420999,
                                "longitude", -51.933056))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("INVALID_INVITE_SIGNATURE"));

        // Correct inviteSignature -> 201 Created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(participant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "inviteSignature", sig,
                                "latitude", -23.420999,
                                "longitude", -51.933056))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(participant.userId().toString()))
                .andExpect(jsonPath("$.name").value("Pedro"))
                .andExpect(jsonPath("$.username").value("pedro.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(true))
                .andExpect(jsonPath("$.revealStatus").value("WAITING_DRAW"));

        // Organizer joins own group without inviteSignature -> 201 Created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(org))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(org.userId().toString()));
    }

    @Test
    void shouldJoinOpenGroupWithNullGeolocationFallbackAndReturn201() throws Exception {
        var org = applicationService.registerUser("Org", "org.nogps", "Ab1!cd");
        var participant = applicationService.registerUser("Julia", "julia.silva", "Dd4$ee");
        var group = applicationService.createGroup(org.userId(), "Natal Sem GPS");
        String sig = extractSig(group);

        Map<String, Object> body = new HashMap<>();
        body.put("inviteSignature", sig);
        body.put("latitude", null);
        body.put("longitude", null);

        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(participant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("julia.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(false));
    }

    @Test
    void shouldSupportDirectUnauthenticatedVisitorRegistrationAndAvoidOrphanOnInvalidSignature() throws Exception {
        var org = applicationService.registerUser("Org", "org.whats", "Ab1!cd");
        var group = applicationService.createGroup(org.userId(), "Natal Link Direto");
        String sig = extractSig(group);

        // Wrong inviteSignature -> 403 and no orphan user created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Orphan User",
                                "username", "orphan.it",
                                "pin", "Ee5%ff",
                                "inviteSignature", "wrong-signature"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("INVALID_INVITE_SIGNATURE"));

        assertThat(userAccountRepository.findByUsername(new Username("orphan.it"))).isEmpty();

        // Valid inviteSignature -> 201 with HttpOnly cookies and no token in JSON
        MvcResult joinRes = mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Vovó Helena",
                                "username", "vovo.helena",
                                "password", "Ee5%ff",
                                "inviteSignature", sig,
                                "latitude", -23.42,
                                "longitude", -51.93))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vovó Helena"))
                .andExpect(jsonPath("$.username").value("vovo.helena"))
                .andExpect(jsonPath("$.hasGeoLocation").value(true))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andReturn();

        assertThat(joinRes.getResponse().getCookie(AuthCookieManager.ACCESS_TOKEN_COOKIE)).isNotNull();
        assertThat(joinRes.getResponse().getCookie(AuthCookieManager.REFRESH_TOKEN_COOKIE)).isNotNull();
    }

    @Test
    void shouldRejectDuplicateRegistrationOrJoiningAlreadyDrawnGroupWith409_C11() throws Exception {
        var u1 = applicationService.registerUser("U1", "u1.dup", "Ab1!cd");
        var u2 = applicationService.registerUser("U2", "u2.dup", "Ab1!cd");
        var u3 = applicationService.registerUser("U3", "u3.dup", "Ab1!cd");
        var u4 = applicationService.registerUser("U4", "u4.dup", "Ab1!cd");

        var group = applicationService.createGroup(u1.userId(), "Natal Conflito");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), sig, null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), sig, null, null);

        // User already enrolled in the group -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(u1))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        // Draw the group
        applicationService.executeDraw(group.id(), u1.userId());

        // New user attempting to join after draw -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .cookie(accessCookie(u4))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("inviteSignature", sig))))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRevealDrawnMatchWithValidUsernameAndPinAndMarkRevealed_C30() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas", "Aa1!bb");
        var u2 = applicationService.registerUser("Mariana", "mariana", "Bb2@cc");
        var u3 = applicationService.registerUser("Rafael", "rafael", "Cc3#dd");

        var group = applicationService.createGroup(u1.userId(), "Natal Revelar");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), u1.userId(), null, -23.42, -51.93);
        applicationService.registerParticipant(group.id(), u2.userId(), sig, -23.45, -51.95);
        applicationService.registerParticipant(group.id(), u3.userId(), sig, -23.48, -51.98);
        applicationService.executeDraw(group.id(), u1.userId());

        MvcResult res = mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas",
                                "pin", "Aa1!bb"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantId").isNotEmpty())
                .andExpect(jsonPath("$.username").value("lucas"))
                .andExpect(jsonPath("$.drawnParticipantName").isNotEmpty())
                .andExpect(jsonPath("$.revealedAt").isNotEmpty())
                .andReturn();

        String drawnName = objectMapper.readTree(res.getResponse().getContentAsString())
                .get("drawnParticipantName").asText();
        assertThat(drawnName).isIn("Mariana", "Rafael");
    }

    @Test
    void shouldRejectRevealWithWrongPinOrNonMemberUsernameWith401_C31() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas.c31", "Aa1!bb");
        var u2 = applicationService.registerUser("Mariana", "mariana.c31", "Bb2@cc");
        var u3 = applicationService.registerUser("Rafael", "rafael.c31", "Cc3#dd");
        applicationService.registerUser("Forasteiro", "forasteiro.c31", "Ff6^gg");

        var group = applicationService.createGroup(u1.userId(), "Natal C31");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), sig, null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), sig, null, null);
        applicationService.executeDraw(group.id(), u1.userId());

        // Incorrect PIN -> 401
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c31",
                                "pin", "Xy9!zw"))))
                .andExpect(status().isUnauthorized());

        // Username not enrolled in group -> 401
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "forasteiro.c31",
                                "pin", "Ff6^gg"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectRevealWhenGroupIsStillOpenWith409_C32() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas.c32", "Aa1!bb");
        var group = applicationService.createGroup(u1.userId(), "Natal Aberto C32");
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);

        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c32",
                                "password", "Aa1!bb"))))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldAuthenticateAndReturn409AlreadyParticipantWithCookiesWhenExistingMemberLogsInViaInvite() throws Exception {
        var org = applicationService.registerUser("Org", "org.rejoin.it", "Ab1!cd");
        var member = applicationService.registerUser("Membro", "membro.rejoin.it", "Bb2@cc");
        var group = applicationService.createGroup(org.userId(), "Natal Rejoin");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), member.userId(), sig, null, null);

        // Rotate invite signature to ensure already-joined member still authenticates on 409
        applicationService.rotateInviteSignature(group.id(), org.userId());

        // Visitor login (name omitted) for already-joined member -> 409 ALREADY_PARTICIPANT with HttpOnly cookies
        MvcResult rejoinRes = mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "membro.rejoin.it",
                                "password", "Bb2@cc",
                                "inviteSignature", sig))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("ALREADY_PARTICIPANT"))
                .andExpect(jsonPath("$.userId").value(member.userId().toString()))
                .andExpect(jsonPath("$.name").value("Membro"))
                .andExpect(jsonPath("$.username").value("membro.rejoin.it"))
                .andExpect(jsonPath("$.groupId").value(group.id().toString()))
                .andExpect(jsonPath("$.redirectPath").value("/g/" + group.id()))
                .andReturn();

        Cookie accessCookie = rejoinRes.getResponse().getCookie(AuthCookieManager.ACCESS_TOKEN_COOKIE);
        Cookie refreshCookie = rejoinRes.getResponse().getCookie(AuthCookieManager.REFRESH_TOKEN_COOKIE);
        assertThat(accessCookie).isNotNull();
        assertThat(refreshCookie).isNotNull();

        // Using the issued cookie on GET /groups/{groupId} shows member as joined and participantsVisible=true
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id()).cookie(accessCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.participantsVisible").value(true));

        // Duplicate registration (name filled) with existing username -> 409 CONFLICT without cookies
        MvcResult dupRegRes = mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Impostor",
                                "username", "membro.rejoin.it",
                                "password", "Cc3#dd",
                                "inviteSignature", extractSig(applicationService.getAdminGroup(group.id(), org.userId()))))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CONFLICT"))
                .andReturn();

        assertThat(dupRegRes.getResponse().getCookie(AuthCookieManager.ACCESS_TOKEN_COOKIE)).isNull();
        assertThat(dupRegRes.getResponse().getCookie(AuthCookieManager.REFRESH_TOKEN_COOKIE)).isNull();
    }

    @Test
    void shouldReturn401OnGetPublicGroupWhenAccessCookieIsInvalid() throws Exception {
        var org = applicationService.registerUser("Org", "org.inv.cookie", "Ab1!cd");
        var group = applicationService.createGroup(org.userId(), "Grupo Cookie");

        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .cookie(new Cookie(AuthCookieManager.ACCESS_TOKEN_COOKIE, "invalid.token.value")))
                .andExpect(status().isUnauthorized());
    }
}
