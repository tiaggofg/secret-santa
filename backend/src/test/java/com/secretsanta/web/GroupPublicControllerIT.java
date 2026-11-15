package com.secretsanta.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.UserAccountRepository;
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
    void shouldListOnlyMyGroupsForAuthenticatedUser() throws Exception {
        var userA = applicationService.registerUser("User A", "user.a", "1234");
        var userB = applicationService.registerUser("User B", "user.b", "1234");

        var myGroup = applicationService.createGroup(userA.userId(), "Grupo do User A", "1234");
        applicationService.registerParticipant(myGroup.id(), userA.userId(), null, -23.42, -51.93);

        applicationService.createGroup(userB.userId(), "Grupo Privado B", "5678");

        mockMvc.perform(get("/api/v1/groups")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + userA.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myGroups.length()").value(1))
                .andExpect(jsonPath("$.myGroups[0].id").value(myGroup.id().toString()))
                .andExpect(jsonPath("$.myGroups[0].sharePath").value("/g/" + myGroup.id()))
                .andExpect(jsonPath("$.myGroups[0].organizer").value(true))
                .andExpect(jsonPath("$.myGroups[0].joined").value(true))
                .andExpect(jsonPath("$.availableGroups").doesNotExist());
    }

    @Test
    void shouldHideParticipantsForNonMembersAndExposeForMembersAndReturn404ForInvalidUuid() throws Exception {
        var org = applicationService.registerUser("Org", "org.pub", "1234");
        var member = applicationService.registerUser("Membro", "membro.pub", "2222");
        var outsider = applicationService.registerUser("Visitante", "outsider.pub", "3333");

        var group = applicationService.createGroup(org.userId(), "Natal Privado", "4321");
        applicationService.registerParticipant(group.id(), member.userId(), "4321", -23.42, -51.93);

        // Anonymous visitor -> participantsVisible: false, participants: []
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(group.id().toString()))
                .andExpect(jsonPath("$.eventName").value("Natal Privado"))
                .andExpect(jsonPath("$.participantCount").value(1))
                .andExpect(jsonPath("$.participantsVisible").value(false))
                .andExpect(jsonPath("$.participants.length()").value(0));

        // Authenticated non-member -> participantsVisible: false
        mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + outsider.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantsVisible").value(false))
                .andExpect(jsonPath("$.participants.length()").value(0));

        // Member -> participantsVisible: true with full participants list
        MvcResult res = mockMvc.perform(get("/api/v1/groups/{groupId}", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(group.id().toString()))
                .andExpect(jsonPath("$.eventName").value("Natal Privado"))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.organizer").value(false))
                .andExpect(jsonPath("$.participantsVisible").value(true))
                .andExpect(jsonPath("$.participantCount").value(1))
                .andExpect(jsonPath("$.participants.length()").value(1))
                .andExpect(jsonPath("$.participants[0].username").value("membro.pub"))
                .andReturn();

        assertThat(res.getResponse().getContentAsString())
                .doesNotContain("drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash");

        // Invalid UUID -> 404
        mockMvc.perform(get("/api/v1/groups/{groupId}", "not-a-uuid"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldJoinOpenGroupWithValidGroupPinAndRejectInvalidGroupPinWith403() throws Exception {
        var org = applicationService.registerUser("Org", "org.join", "1234");
        var participant = applicationService.registerUser("Pedro", "pedro.silva", "4567");
        var group = applicationService.createGroup(org.userId(), "Natal GPS", "7890");

        // Wrong group PIN -> 403 INVALID_GROUP_PIN
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + participant.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "groupPin", "0000",
                                "latitude", -23.420999,
                                "longitude", -51.933056))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("INVALID_GROUP_PIN"));

        // Correct group PIN -> 201 Created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + participant.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "groupPin", "7890",
                                "latitude", -23.420999,
                                "longitude", -51.933056))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(participant.userId().toString()))
                .andExpect(jsonPath("$.name").value("Pedro"))
                .andExpect(jsonPath("$.username").value("pedro.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(true))
                .andExpect(jsonPath("$.revealStatus").value("WAITING_DRAW"));

        // Organizer joins own group without groupPin -> 201 Created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + org.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(org.userId().toString()));
    }

    @Test
    void shouldJoinOpenGroupWithNullGeolocationFallbackAndReturn201() throws Exception {
        var org = applicationService.registerUser("Org", "org.nogps", "1234");
        var participant = applicationService.registerUser("Julia", "julia.silva", "4567");
        var group = applicationService.createGroup(org.userId(), "Natal Sem GPS", "1234");

        Map<String, Object> body = new HashMap<>();
        body.put("groupPin", "1234");
        body.put("latitude", null);
        body.put("longitude", null);

        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + participant.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("julia.silva"))
                .andExpect(jsonPath("$.hasGeoLocation").value(false));
    }

    @Test
    void shouldSupportDirectUnauthenticatedVisitorRegistrationAndAvoidOrphanOnWrongGroupPin() throws Exception {
        var org = applicationService.registerUser("Org", "org.whats", "1234");
        var group = applicationService.createGroup(org.userId(), "Natal Link Direto", "9876");

        // Wrong groupPin -> 403 and no orphan user created
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Orphan User",
                                "username", "orphan.it",
                                "pin", "1945",
                                "groupPin", "0000"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("INVALID_GROUP_PIN"));

        assertThat(userAccountRepository.findByUsername(new Username("orphan.it"))).isEmpty();

        // Valid groupPin -> 201
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Vovó Helena",
                                "username", "vovo.helena",
                                "pin", "1945",
                                "groupPin", "9876",
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

        var group = applicationService.createGroup(u1.userId(), "Natal Conflito", "1234");
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", null, null);

        // User already enrolled in the group -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + u1.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        // Draw the group
        applicationService.executeDraw(group.id(), u1.userId());

        // New user attempting to join after draw -> 409 Conflict
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants", group.id())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + u4.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("groupPin", "1234"))))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRevealDrawnMatchWithValidUsernameAndPinAndMarkRevealed_C30() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas", "1111");
        var u2 = applicationService.registerUser("Mariana", "mariana", "2222");
        var u3 = applicationService.registerUser("Rafael", "rafael", "3333");

        var group = applicationService.createGroup(u1.userId(), "Natal Revelar", "1234");
        applicationService.registerParticipant(group.id(), u1.userId(), null, -23.42, -51.93);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", -23.45, -51.95);
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", -23.48, -51.98);
        applicationService.executeDraw(group.id(), u1.userId());

        MvcResult res = mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
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

        var group = applicationService.createGroup(u1.userId(), "Natal C31", "1234");
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), "1234", null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), "1234", null, null);
        applicationService.executeDraw(group.id(), u1.userId());

        // Incorrect PIN -> 401
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c31",
                                "pin", "9999"))))
                .andExpect(status().isUnauthorized());

        // Username not enrolled in group -> 401
        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "forasteiro.c31",
                                "pin", "4444"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectRevealWhenGroupIsStillOpenWith409_C32() throws Exception {
        var u1 = applicationService.registerUser("Lucas", "lucas.c32", "1111");
        var group = applicationService.createGroup(u1.userId(), "Natal Aberto C32", "1234");
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);

        mockMvc.perform(post("/api/v1/groups/{groupId}/participants/reveal", group.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "lucas.c32",
                                "pin", "1111"))))
                .andExpect(status().isConflict());
    }
}
