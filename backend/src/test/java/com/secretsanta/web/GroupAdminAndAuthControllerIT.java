package com.secretsanta.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.ParticipantRegistrationView;
import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.infrastructure.persistence.SecretSantaGroupDocument;
import com.secretsanta.infrastructure.persistence.SecretSantaIndexesChangeUnit;
import com.secretsanta.infrastructure.persistence.UserAccountDocument;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ContextConfiguration(initializers = MongoTestContainerConfig.class)
class GroupAdminAndAuthControllerIT {

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
        mongoTemplate.dropCollection(SecretSantaGroupDocument.class);
        indexesChangeUnit.ensureIndexes();
    }

    @Test
    void shouldRegisterValidUserAccountAndReturn201WithStatelessToken_C1() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Tiago Godoy",
                "username", "tiago.godoy",
                "pin", "1234"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Tiago Godoy"))
                .andExpect(jsonPath("$.username").value("tiago.godoy"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.pinHash").doesNotExist());

        UserAccount saved = userAccountRepository.findByUsername(new Username("tiago.godoy")).orElseThrow();
        assertThat(saved.pinHash().value()).startsWith("$2");
    }

    @Test
    void shouldRejectInvalidRegisterPayloadsWith400_C2() throws Exception {
        // Name too short (< 2 chars)
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "A",
                                "username", "valid.user",
                                "pin", "1234"))))
                .andExpect(status().isBadRequest());

        // Username invalid pattern
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Ana Silva",
                                "username", "ab",
                                "pin", "1234"))))
                .andExpect(status().isBadRequest());

        // PIN not 4..6 numeric digits
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Ana Silva",
                                "username", "ana.silva",
                                "pin", "12a4"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectDuplicateUsernameCaseInsensitivelyWith409_C3() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Maria Um",
                                "username", "maria.silva",
                                "pin", "1234"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Maria Dois",
                                "username", "  MARIA.SILVA ",
                                "pin", "5678"))))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldLoginValidUserAndReturn200WithToken_C4() throws Exception {
        applicationService.registerUser("Carlos Eduardo", "carlos.edu", "4321");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "CARLOS.EDU",
                                "pin", "4321"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Carlos Eduardo"))
                .andExpect(jsonPath("$.username").value("carlos.edu"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void shouldRejectLoginWithUnknownUserOrWrongPinWith401_C5() throws Exception {
        applicationService.registerUser("Carlos Eduardo", "carlos.edu", "4321");

        // Wrong PIN
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "carlos.edu",
                                "pin", "9999"))))
                .andExpect(status().isUnauthorized());

        // Non-existent username
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "inexistente",
                                "pin", "4321"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldCreateGroupSettingOrganizerUserIdAndReturn201WithSharePath_C13() throws Exception {
        var organizer = applicationService.registerUser("Organizador", "org.natal", "1234");

        MvcResult result = mockMvc.perform(post("/api/v1/groups")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eventName", "Natal da Família Silva",
                                "groupPin", "4321"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.eventName").value("Natal da Família Silva"))
                .andExpect(jsonPath("$.organizerUserId").value(organizer.userId().toString()))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.sharePath").isNotEmpty())
                .andExpect(jsonPath("$.groupPinHash").doesNotExist())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String id = json.get("id").asText();
        assertThat(json.get("sharePath").asText()).isEqualTo("/g/" + id);
    }

    @Test
    void shouldRejectGroupCreationWithShortEventNameOrInvalidGroupPinWith400_C14() throws Exception {
        var organizer = applicationService.registerUser("Organizador", "org.curto", "1234");

        mockMvc.perform(post("/api/v1/groups")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eventName", "Oi",
                                "groupPin", "1234"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/groups")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "eventName", "Natal Válido",
                                "groupPin", "12"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldUpdateGroupPinViaPutAdminPinAndValidateNewPinOnJoin() throws Exception {
        var organizer = applicationService.registerUser("Org", "org.pin", "1234");
        var member = applicationService.registerUser("Membro", "mem.pin", "1234");

        var group = applicationService.createGroup(organizer.userId(), "Natal Alterar PIN", "1111");

        // Non-organizer cannot update PIN -> 403
        mockMvc.perform(put("/api/v1/groups/{groupId}/admin/pin", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + member.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("groupPin", "9999"))))
                .andExpect(status().isForbidden());

        // Organizer updates PIN -> 204
        mockMvc.perform(put("/api/v1/groups/{groupId}/admin/pin", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("groupPin", "9999"))))
                .andExpect(status().isNoContent());

        // Old PIN fails -> 403 INVALID_GROUP_PIN
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + member.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("groupPin", "1111"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("INVALID_GROUP_PIN"));

        // New PIN succeeds -> 201
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + member.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("groupPin", "9999"))))
                .andExpect(status().isCreated());
    }

    @Test
    void shouldReturnAdminGroupWithParticipantsAndNeverExposeSecretFields_C15_C16() throws Exception {
        var organizer = applicationService.registerUser("Ana Org", "ana.org", "1234");
        var u2 = applicationService.registerUser("Bruno", "bruno", "2345");
        var u3 = applicationService.registerUser("Clara", "clara", "3456");

        var group = applicationService.createGroup(organizer.userId(), "Natal Sigiloso", "1234");
        applicationService.registerParticipant(group.id(), organizer.userId(), null, -23.42, -51.93);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", -23.45, -51.95);
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", null, null);
        applicationService.executeDraw(group.id(), organizer.userId());

        MvcResult result = mockMvc.perform(get("/api/v1/groups/{groupId}/admin", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventName").value("Natal Sigiloso"))
                .andExpect(jsonPath("$.status").value("DRAWN"))
                .andExpect(jsonPath("$.participants.length()").value(3))
                .andExpect(jsonPath("$.participants[0].id").isNotEmpty())
                .andExpect(jsonPath("$.participants[0].userId").value(organizer.userId().toString()))
                .andExpect(jsonPath("$.participants[0].name").value("Ana Org"))
                .andExpect(jsonPath("$.participants[0].username").value("ana.org"))
                .andExpect(jsonPath("$.participants[0].hasGeoLocation").value(true))
                .andExpect(jsonPath("$.participants[0].revealStatus").value("PENDING_REVEAL"))
                .andExpect(jsonPath("$.participants[0].createdAt").isNotEmpty())
                .andReturn();

        String rawJson = result.getResponse().getContentAsString();
        assertThat(rawJson).doesNotContain("drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash");
    }

    @Test
    void shouldRemoveParticipantWhileOpenWith204AndRejectWhenDrawnWith409_C17_C18() throws Exception {
        var organizer = applicationService.registerUser("Org", "org.del", "1234");
        var u2 = applicationService.registerUser("U2", "u2.del", "1234");
        var u3 = applicationService.registerUser("U3", "u3.del", "1234");
        var u4 = applicationService.registerUser("U4", "u4.del", "1234");

        var group = applicationService.createGroup(organizer.userId(), "Natal Remoção", "1234");
        ParticipantRegistrationView p1 = applicationService.registerParticipant(group.id(), organizer.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", null, null);
        ParticipantRegistrationView p4 = applicationService.registerParticipant(group.id(), u4.userId(), "1234", null, null);

        // C17: Delete while OPEN -> 204
        mockMvc.perform(delete("/api/v1/groups/{groupId}/admin/participants/{participantId}", group.id(), p4.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isNoContent());

        // Draw group
        applicationService.executeDraw(group.id(), organizer.userId());

        // C18: Delete after DRAWN -> 409 Conflict
        mockMvc.perform(delete("/api/v1/groups/{groupId}/admin/participants/{participantId}", group.id(), p1.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRejectAdminEndpointsWith401WhenUnauthenticatedAnd403WhenNotOrganizer_C19() throws Exception {
        var organizer = applicationService.registerUser("Org", "org.guard", "1234");
        var otherUser = applicationService.registerUser("Outro", "outro.guard", "1234");

        var group = applicationService.createGroup(organizer.userId(), "Natal Guard", "1234");
        ParticipantRegistrationView p = applicationService.registerParticipant(group.id(), otherUser.userId(), "1234", null, null);

        // Missing token -> 401
        mockMvc.perform(get("/api/v1/groups/{groupId}/admin", group.id()))
                .andExpect(status().isUnauthorized());

        // Different authenticated user -> 403
        mockMvc.perform(get("/api/v1/groups/{groupId}/admin", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherUser.token()))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/groups/{groupId}/admin/participants/{participantId}", group.id(), p.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherUser.token()))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/groups/{groupId}/admin/draw", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherUser.token()))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token", group.id(), p.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherUser.token()))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldGenerateOneTimeResetTokenWith200AndResetPinConsumingToken_C20_C36_C37() throws Exception {
        var organizer = applicationService.registerUser("Org", "org.reset", "1234");
        var member = applicationService.registerUser("Membro", "membro.reset", "1111");

        var group = applicationService.createGroup(organizer.userId(), "Natal Reset", "1234");
        ParticipantRegistrationView joined = applicationService.registerParticipant(group.id(), member.userId(), "1234", null, null);

        // C20: Generate reset token link
        MvcResult tokenRes = mockMvc.perform(post(
                        "/api/v1/groups/{groupId}/admin/participants/{participantId}/reset-token",
                        group.id(),
                        joined.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantId").value(joined.id().toString()))
                .andExpect(jsonPath("$.username").value("membro.reset"))
                .andExpect(jsonPath("$.resetToken").isNotEmpty())
                .andExpect(jsonPath("$.resetPath").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andReturn();

        JsonNode tokenJson = objectMapper.readTree(tokenRes.getResponse().getContentAsString());
        String resetToken = tokenJson.get("resetToken").asText();
        assertThat(tokenJson.get("resetPath").asText()).isEqualTo("/reset/" + resetToken);

        // C36: Consume token to set new PIN
        mockMvc.perform(post("/api/v1/auth/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", resetToken,
                                "newPin", "987654"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("membro.reset"));

        // Verify login with new PIN succeeds
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "membro.reset",
                                "pin", "987654"))))
                .andExpect(status().isOk());

        // C37: Reusing the same token or using a non-existent or expired token returns 400
        mockMvc.perform(post("/api/v1/auth/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", resetToken,
                                "newPin", "1234"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/auth/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", "token-inexistente-xyz",
                                "newPin", "1234"))))
                .andExpect(status().isBadRequest());

        // Expired token scenario
        UserAccount memberAccount = userAccountRepository.findById(member.userId()).orElseThrow();
        String expiredRawToken = "expired-token-123";
        PasswordResetTokenHash expiredHash = SecretSantaApplicationService.hashResetToken(expiredRawToken);
        memberAccount.issuePasswordResetToken(expiredHash, Instant.now().minusSeconds(60));
        userAccountRepository.save(memberAccount);

        mockMvc.perform(post("/api/v1/auth/reset-pin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", expiredRawToken,
                                "newPin", "1234"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldExecuteDrawWith200RejectFewerThanThreeWith422AndRejectAlreadyDrawnWith409_C22_C23_C24() throws Exception {
        var organizer = applicationService.registerUser("Org", "org.draw", "1234");
        var u2 = applicationService.registerUser("U2", "u2.draw", "1234");
        var u3 = applicationService.registerUser("U3", "u3.draw", "1234");

        var group = applicationService.createGroup(organizer.userId(), "Natal Sorteio", "1234");
        applicationService.registerParticipant(group.id(), organizer.userId(), null, -23.42, -51.93);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", -23.45, -51.95);

        // C23: Only 2 participants -> 422 Unprocessable Entity
        mockMvc.perform(post("/api/v1/groups/{groupId}/admin/draw", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isUnprocessableEntity());

        // Add 3rd participant
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", -23.48, -51.98);

        // C22: 3 participants -> 200 OK and status DRAWN
        mockMvc.perform(post("/api/v1/groups/{groupId}/admin/draw", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAWN"))
                .andExpect(jsonPath("$.geographicRestrictionRelaxed").value(false))
                .andExpect(jsonPath("$.drawnAt").isNotEmpty());

        // C24: Already DRAWN -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{groupId}/admin/draw", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + organizer.token()))
                .andExpect(status().isConflict());
    }
}
