package vn.vietduc.carehubbackend.imports.user.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.imports.user.dto.ImportLogResponse;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;
import vn.vietduc.carehubbackend.imports.user.repository.ImportLogRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/system/import-logs")
@RequiredArgsConstructor
public class ImportLogController {
    private final ImportLogRepository importLogRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<ImportLogResponse>>> getImportLogs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Pageable normalized = normalize(pageable);
        if (pageable.getSort().stream().anyMatch(order -> "successfulRows".equals(order.getProperty()))) {
            List<ImportLogResponse> responses = findLogs(q, status, Pageable.unpaged()).stream()
                    .map(ImportLogResponse::from)
                    .sorted(responseComparator(pageable.getSort()))
                    .toList();
            int from = Math.min((int) normalized.getOffset(), responses.size());
            int to = Math.min(from + normalized.getPageSize(), responses.size());
            Page<ImportLogResponse> page = new PageImpl<>(responses.subList(from, to), normalized, responses.size());
            return ResponseEntity.ok(ApiResponse.success("Get import logs successfully", page));
        }
        Page<ImportLog> logs = findLogs(q, status, normalized);

        return ResponseEntity.ok(ApiResponse.success(
                "Get import logs successfully",
                logs.map(ImportLogResponse::from)));
    }

    private Page<ImportLog> findLogs(String q, String status, Pageable pageable) {
        boolean hasQ = q != null && !q.isBlank();
        boolean hasStatus = status != null && !status.isBlank();

        if (hasQ && hasStatus) {
            return importLogRepository.findBySourceFileContainingIgnoreCaseAndStatus(q, status, pageable);
        }
        if (hasQ) return importLogRepository.findBySourceFileContainingIgnoreCase(q, pageable);
        if (hasStatus) return importLogRepository.findByStatus(status, pageable);
        return importLogRepository.findAll(pageable);
    }

    private Pageable normalize(Pageable pageable) {
        Map<String, String> allowed = Map.of(
                "createdAt", "createdAt", "sourceFile", "sourceFile", "totalRows", "totalRows",
                "failedRows", "failedRows", "status", "status");
        Sort sort = pageable.getSort().isUnsorted() ? Sort.by(Sort.Order.desc("createdAt"))
                : Sort.by(pageable.getSort().stream().map(order -> {
                    if ("successfulRows".equals(order.getProperty())) return order;
                    String property = allowed.get(order.getProperty());
                    if (property == null) throw ValidationException.field(
                            "sort", "Trường sắp xếp không được hỗ trợ: " + order.getProperty());
                    return new Sort.Order(order.getDirection(), property);
                }).toList());
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }

    private Comparator<ImportLogResponse> responseComparator(Sort sort) {
        Comparator<ImportLogResponse> comparator = null;
        for (Sort.Order order : sort) {
            if (!"successfulRows".equals(order.getProperty())) throw ValidationException.field(
                    "sort", "Trường sắp xếp không được hỗ trợ: " + order.getProperty());
            Comparator<ImportLogResponse> next = Comparator.comparingInt(
                    item -> item.insertedRows() + item.updatedRows());
            if (order.isDescending()) next = next.reversed();
            comparator = comparator == null ? next : comparator.thenComparing(next);
        }
        return (comparator == null ? Comparator.comparing(ImportLogResponse::id) : comparator)
                .thenComparing(ImportLogResponse::id);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ImportLogResponse>> getImportLog(@PathVariable Long id) {
        ImportLog log = importLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Import log not found"));

        return ResponseEntity.ok(ApiResponse.success(
                "Get import log successfully",
                ImportLogResponse.from(log)));
    }
}
