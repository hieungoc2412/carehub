package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.training.dto.request.ProfessionalFieldFormRequest;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.enums.ProfessionalFieldModerationStatus;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.util.Optional;
import java.util.List;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfessionalFieldAdminServiceTest {
    @Mock
    private ProfessionalFieldRepository repository;

    private ProfessionalFieldAdminService service;

    @BeforeEach
    void setUp() {
        service = new ProfessionalFieldAdminService(repository);
    }

    @Test
    void createsNormalizedActiveField() {
        when(repository.findByCode("CAP_CUU")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new ProfessionalFieldFormRequest(
                "cap cuu", " Chăm sóc cấp cứu ", " Mô tả ", null, null
        ));

        assertEquals("CAP_CUU", response.code());
        assertEquals("Chăm sóc cấp cứu", response.name());
        assertEquals(true, response.active());
        verify(repository).save(any(ProfessionalField.class));
    }

    @Test
    void rejectsDuplicateCode() {
        when(repository.findByCode("CAP_CUU")).thenReturn(Optional.of(
                ProfessionalField.builder().code("CAP_CUU").name("Cấp cứu").build()
        ));

        assertThrows(ConflictException.class, () -> service.create(
                new ProfessionalFieldFormRequest("CAP_CUU", "Tên khác", null, true, null)
        ));
    }

    @Test
    void rejectsPendingEmployeeProposalAndKeepsReason() {
        ProfessionalField pending = ProfessionalField.builder()
                .id(10L)
                .code("CUSTOM_10")
                .name("Điều dưỡng nhi")
                .active(false)
                .moderationStatus(ProfessionalFieldModerationStatus.PENDING)
                .build();
        when(repository.findById(10L)).thenReturn(Optional.of(pending));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.reject(10L);

        assertEquals(ProfessionalFieldModerationStatus.REJECTED, response.moderationStatus());
        assertEquals(null, response.rejectionReason());
        assertEquals(false, response.active());
    }

    @Test
    void exposesOriginalProposerAndCreationTimeAfterModeration() {
        LocalDateTime proposedAt = LocalDateTime.of(2026, 10, 23, 10, 27);
        ProfessionalField field = ProfessionalField.builder()
                .id(10L).code("CUSTOM_10").name("Điều dưỡng nhi")
                .description("Tự đề xuất bởi nhân viên: Dương Ngọc Hiếu (Chờ duyệt)")
                .createdAt(proposedAt).updatedAt(proposedAt.plusDays(3)).updatedBy("admin")
                .moderationStatus(ProfessionalFieldModerationStatus.APPROVED).active(true).build();
        when(repository.search(isNull(), isNull(), any())).thenReturn(new PageImpl<>(List.of(field)));

        var result = service.search(null, null, PageRequest.of(0, 20)).getContent().get(0);

        assertEquals("Dương Ngọc Hiếu", result.proposerName());
        assertEquals(proposedAt, result.createdAt());
        assertEquals(proposedAt.plusDays(3), result.updatedAt());
        assertEquals(field.getDescription(), result.description());
    }

    @Test
    void leavesProposerUnknownForCatalogDescriptionsAndMissingMetadata() {
        ProfessionalField catalog = ProfessionalField.builder()
                .code("CAP_CUU").name("Cấp cứu").description("Mô tả lĩnh vực").updatedBy("admin").build();
        ProfessionalField missing = ProfessionalField.builder()
                .code("CUSTOM_11").name("Lĩnh vực cũ").build();
        ProfessionalField emptyName = ProfessionalField.builder()
                .code("CUSTOM_12").name("Lĩnh vực khác")
                .description("Tự đề xuất bởi nhân viên:  (Chờ duyệt)").build();
        when(repository.search(isNull(), isNull(), any())).thenReturn(new PageImpl<>(List.of(catalog, missing, emptyName)));

        var results = service.search(null, null, PageRequest.of(0, 20)).getContent();

        results.forEach(result -> assertNull(result.proposerName()));
        results.forEach(result -> assertNull(result.createdAt()));
    }
}
