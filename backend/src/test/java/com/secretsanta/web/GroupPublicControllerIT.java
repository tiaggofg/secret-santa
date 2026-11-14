package com.secretsanta.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.infrastructure.persistence.SecretSantaGroupDocument;
import com.secretsanta.infrastructure.persistence.SecretSantaIndexesChangeUnit;
import com.secretsanta.infrastructure.persistence.UserAccountDocument;
import java.util.HashMap;
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
class GroupPublicControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SecretSantaApplicationService applicationService;

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
    void shouldListMyGroupsAndAvailableOpenGroupsForAuthenticatedUser_C6() throws Exception {
        var userA = applicationService.registerUser("User A", "user.a", "1234");
        var userB = applicationService.registerUser("User B", "user.b", "1234");

        var myGroup = applicationService.createGroup(userA.userId(), "Grupo do User A");
        applicationService.registerParticipant(myGroup.slug(), userA.userId(), -23.42, -51.93);

        var openAvailableGroup = applicationService.createGroup(userB.userId(), "Grupo Aberto da Família");

        mockMvc.perform(get("/api/v1/groups")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + userA.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myGroups.length()").value(1))
                .andExpect(jsonPath("$.myGroups[0].slug").value(myGroup.slug()))
                .andExpect(jsonPath("$.myGroups[0].organizer").value(true))
                .andExpect(jsonPath("$.myGroups[0].joined").value(true))
                .andExpect(jsonPath("$.availableGroups.length()").value(1))
                .andExpect(jsonPath("$.availableGroups[0].slug").value(openAvailableGroup.slug()))
                .andExpect(jsonPath("$.availableGroups[0].status").value("OPEN"));
    }

    @Test
    void shouldGetPublicGroupDetailsBySlugAndOmitSensitiveFields() throws Exception {
        var org = applicationService.registerUser("Org", "org.pub", "1234");
        var member = applicationService.registerUser("Membro", "membro.pub", "2222");

        var group = applicationService.createGroup(org.userId(), "Natal Público");
        applicationService.registerParticipant(group.slug(), member.userId(), -23.42, -51.93);

        MvcResult res = mockMvc.perform(get("/api/v1/groups/{slug}", group.slug())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(group.slug()))
                .andExpect(jsonPath("$.eventName").value("Natal Público"))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.organizer").value(false))
                .andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.participants[0].username").value("membro.pub"))
                .andReturn();

        assertThat(res.getResponse().getContentAsString())
                .doesNotContain("drawnParticipantId", "pinHash", "resetTokenHash");
    }

    @Test
    void shouldJoinOpenGroupWithValidGeolocationAndReturn201_C8() throws Exception {
        var org = applicationService.registerUser("Org", "org.join", "1234");
        var participant = applicationService.registerUser("Pedro", "pedro.silva", "4567");
        var group = applicationService.createGroup(org.userId(), "Natal GPS");

        mockMvc.perform(post("/api/v1/groups/{slug}/participants", group.slug())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + participant.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "latitude", -23.420999,
                                "longitude", -51.933056))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(participant.userId().toString()))
                .andExpect(jsonPath("$.name").value("Pedro"))
                .andExpect(jsonPath("$.username").value("pedro.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(true))
                .andExpect(jsonPath("$.revealStatus").value("WAITING_DRAW"));
    }

    @Test
    void shouldJoinOpenGroupWithNullGeolocationFallbackAndReturn201() throws Exception {
        var org = applicationService.registerUser("Org", "org.nogps", "1234");
        var participant = applicationService.registerUser("Julia", "julia.silva", "4567");
        var group = applicationService.createGroup(org.userId(), "Natal Sem GPS");

        Map<String, Object> body = new HashMap<>();
        body.put("latitude", null);
        body.put("longitude", null);

        mockMvc.perform(post("/api/v1/groups/{slug}/participants", group.slug())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + participant.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("julia.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(false));
    }

    @Test
    void shouldSupportDirectUnauthenticatedVisitorRegistrationAndJoinViaWhatsAppLink() throws Exception {
        var org = applicationService.registerUser("Org", "org.whats", "1234");
        var group = applicationService.createGroup(org.userId(), "Natal Link Direto");

        mockMvc.perform(post("/api/v1/groups/{slug}/participants", group.slug())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Vovó Helena",
                                "username", "vovo.helena",
                                "pin", "1945",
                                "latitude", -23.42,
                                "longitude", -51.93))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Vovó Helena"))
                .andExpect(jsonPath("$.username").value("vovo.helena"))
                .andExpect(jsonPath("$.hasGeoLocation").value(true))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void shouldRejectDuplicateRegistrationOrJoiningAlreadyDrawnGroupWith409_C11() throws Exception {
        var u1 = applicationService.registerUser("U1", "u1.dup", "1234");
        var u2 = applicationService.registerUser("U2", "u2.dup", "1234");
        var u3 = applicationService.registerUser("U3", "u3.dup", "1234");
        var u4 = applicationService.registerUser("U4", "u4.dup", "1234");

        var group = applicationService.createGroup(u1.userId(), "Natal Conflito");
        applicationService.registerParticipant(group.slug(), u1.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u2.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u3.userId(), null, null);

        // User already enrolled in the group -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{slug}/participants", group.slug())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + u1.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        // Draw the group
        applicationService.executeDraw(group.slug(), u1.userId());

        // New user attempting to join after draw -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{slug}/participants", group.slug())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + u4.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRevealDrawnMatchWithValidUsernameAndPinAndMarkRevealed_C30() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas", "1111");
        var u2 = applicationService.registerUser("Mariana", "mariana", "2222");
        var u3 = applicationService.registerUser("Rafael", "rafael", "3333");

        var group = applicationService.createGroup(u1.userId(), "Natal Revelar");
        applicationService.registerParticipant(group.slug(), u1.userId(), -23.42, -51.93);
        applicationService.registerParticipant(group.slug(), u2.userId(), -23.45, -51.95);
        applicationService.registerParticipant(group.slug(), u3.userId(), -23.48, -51.98);
        applicationService.executeDraw(group.slug(), u1.userId());

        MvcResult res = mockMvc.perform(post("/api/v1/groups/{slug}/participants/reveal", group.slug())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas",
                                "pin", "1111"))))
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
        var u1 = applicationService.registerUser("Lucas", "lucas.c31", "1111");
        var u2 = applicationService.registerUser("Mariana", "mariana.c31", "2222");
        var u3 = applicationService.registerUser("Rafael", "rafael.c31", "3333");
        applicationService.registerUser("Forasteiro", "forasteiro.c31", "4444");

        var group = applicationService.createGroup(u1.userId(), "Natal C31");
        applicationService.registerParticipant(group.slug(), u1.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u2.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u3.userId(), null, null);
        applicationService.executeDraw(group.slug(), u1.userId());

        // Incorrect PIN -> 401
        mockMvc.perform(post("/api/v1/groups/{slug}/participants/reveal", group.slug())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c31",
                                "pin", "9999"))))
                .andExpect(status().isUnauthorized());

        // Username not enrolled in group -> 401
        mockMvc.perform(post("/api/v1/groups/{slug}/participants/reveal", group.slug())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "forasteiro.c31",
                                "pin", "4444"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectRevealWhenGroupIsStillOpenWith409_C32() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas.c32", "1111");
        var group = applicationService.createGroup(u1.userId(), "Natal Aberto C32");
        applicationService.registerParticipant(group.slug(), u1.userId(), null, null);

        mockMvc.perform(post("/api/v1/groups/{slug}/participants/reveal", group.slug())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c32",
                                "pin", "1111"))))
                .andExpect(status().isConflict());
    }
}
