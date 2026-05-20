package com.traveldiary.service;

import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.traveldiary.entity.JournalEntry;
import com.traveldiary.entity.Media;
import com.traveldiary.entity.Place;
import com.traveldiary.entity.Trip;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TripPdfService {

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private static final Color PRIMARY_COLOR = new Color(99, 102, 241);
    private static final Color HEADER_BG     = new Color(238, 242, 255);
    private static final Color GRAY_TEXT     = new Color(100, 116, 139);
    private static final Color LIGHT_GRAY   = new Color(241, 245, 249);
    private static final Color DIVIDER      = new Color(226, 232, 240);

    public byte[] generateTripPdf(Trip trip,
                                  boolean includeDescription,
                                  boolean includePlaces,
                                  boolean includeJournal) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 40, 40, 50, 40);
            PdfWriter.getInstance(document, baos);
            document.open();

            byte[] fontBytes;
            try {
                org.springframework.core.io.ClassPathResource fontResource = new org.springframework.core.io.ClassPathResource("fonts/Roboto-Regular.ttf");
                fontBytes = fontResource.getInputStream().readAllBytes();
            } catch (Exception e) {
                File localFont = new File("src/main/resources/fonts/Roboto-Regular.ttf");
                if (localFont.exists()) {
                    fontBytes = java.nio.file.Files.readAllBytes(localFont.toPath());
                } else {
                    throw new RuntimeException("Шрифт Roboto не найден ни в classpath, ни в исходном каталоге", e);
                }
            }
            BaseFont baseFont = BaseFont.createFont("Roboto-Regular.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, fontBytes, null);

            Font titleFont    = new Font(baseFont, 24, Font.BOLD, PRIMARY_COLOR);
            Font subtitleFont = new Font(baseFont, 14, Font.NORMAL, GRAY_TEXT);
            Font normalFont   = new Font(baseFont, 11, Font.NORMAL, Color.DARK_GRAY);
            Font boldFont     = new Font(baseFont, 11, Font.BOLD, Color.DARK_GRAY);
            Font sectionFont  = new Font(baseFont, 16, Font.BOLD, PRIMARY_COLOR);
            Font smallFont    = new Font(baseFont, 9, Font.NORMAL, GRAY_TEXT);

            addHeader(document, trip, titleFont, subtitleFont, smallFont);

            if (includeDescription && trip.getDescription() != null && !trip.getDescription().isBlank()) {
                addDescription(document, trip, sectionFont, normalFont);
            }
            if (includePlaces && trip.getPlaces() != null && !trip.getPlaces().isEmpty()) {
                addPlaces(document, trip.getPlaces(), sectionFont, normalFont, boldFont, smallFont);
            }
            if (includeJournal && trip.getJournalEntries() != null && !trip.getJournalEntries().isEmpty()) {
                addJournal(document, trip.getJournalEntries(), sectionFont, normalFont, boldFont, smallFont);
            }

            addFooter(document, smallFont);
            document.close();
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("Ошибка генерации PDF для поездки {}: {}", trip.getId(), e.getMessage(), e);
            throw new RuntimeException("Не удалось сгенерировать PDF", e);
        }
    }

    private void addHeader(Document doc, Trip trip, Font titleFont, Font subtitleFont, Font smallFont)
            throws DocumentException {
        Paragraph title = new Paragraph(trip.getTitle(), titleFont);
        title.setSpacingAfter(8);
        doc.add(title);

        StringBuilder meta = new StringBuilder();
        if (trip.getCity() != null) meta.append(trip.getCity());
        if (trip.getCountry() != null) {
            if (!meta.isEmpty()) meta.append(", ");
            meta.append(trip.getCountry());
        }
        if (trip.getStartDate() != null) {
            meta.append("   |   ").append(trip.getStartDate().format(DATE_FMT));
            if (trip.getEndDate() != null) meta.append(" - ").append(trip.getEndDate().format(DATE_FMT));
        }

        Paragraph metaPara = new Paragraph(meta.toString(), subtitleFont);
        metaPara.setSpacingAfter(6);
        doc.add(metaPara);

        Set<String> tagNames = trip.getTags().stream().map(tag -> tag.getName()).collect(Collectors.toSet());
        if (!tagNames.isEmpty()) {
            String tagsStr = tagNames.stream().map(t -> "#" + t).collect(Collectors.joining("  "));
            Paragraph tagsPara = new Paragraph(tagsStr, smallFont);
            tagsPara.setSpacingAfter(4);
            doc.add(tagsPara);
        }

        String statusText = switch (trip.getStatus()) {
            case PLANNED -> "Запланирована";
            case ACTIVE -> "В пути";
            case COMPLETED -> "Завершена";
        };
        Paragraph statusPara = new Paragraph("Статус: " + statusText, smallFont);
        statusPara.setSpacingAfter(16);
        doc.add(statusPara);

        addDivider(doc);
    }

    private void addDescription(Document doc, Trip trip, Font sectionFont, Font normalFont) throws DocumentException {
        Paragraph sectionTitle = new Paragraph("Описание", sectionFont);
        sectionTitle.setSpacingBefore(12);
        sectionTitle.setSpacingAfter(8);
        doc.add(sectionTitle);

        String cleanDescription = trip.getDescription().replaceAll("<[^>]+>", "");
        Paragraph desc = new Paragraph(cleanDescription, normalFont);
        desc.setSpacingAfter(16);
        doc.add(desc);

        addDivider(doc);
    }

    private void addPlaces(Document doc, List<Place> places, Font sectionFont, Font normalFont,
                           Font boldFont, Font smallFont) throws DocumentException {
        Paragraph sectionTitle = new Paragraph("Места (" + places.size() + ")", sectionFont);
        sectionTitle.setSpacingBefore(12);
        sectionTitle.setSpacingAfter(8);
        doc.add(sectionTitle);

        PdfPTable table = new PdfPTable(new float[]{3f, 2f, 1.5f, 1f});
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        String[] headers = {"Название", "Адрес", "Категория", "Рейтинг"};
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, boldFont));
            cell.setBackgroundColor(HEADER_BG);
            cell.setPadding(6);
            cell.setBorderColor(DIVIDER);
            table.addCell(cell);
        }

        for (Place place : places) {
            addTableCell(table, place.getName(), normalFont);
            addTableCell(table, place.getAddress() != null ? place.getAddress() : "—", smallFont);
            addTableCell(table, categoryLabel(place.getCategory()), smallFont);
            String rating = place.getRating() != null ? place.getRating() + " / 5" : "—";
            addTableCell(table, rating, smallFont);
        }

        doc.add(table);

        for (Place place : places) {
            if (place.getDescription() != null && !place.getDescription().isBlank()) {
                Paragraph note = new Paragraph();
                note.add(new Chunk(place.getName() + ": ", boldFont));
                note.add(new Chunk(place.getDescription(), smallFont));
                note.setSpacingAfter(4);
                doc.add(note);
            }
        }

        addDivider(doc);
    }

    private void addJournal(Document doc, List<JournalEntry> entries, Font sectionFont, Font normalFont,
                            Font boldFont, Font smallFont) throws DocumentException {
        Paragraph sectionTitle = new Paragraph("Записи дневника (" + entries.size() + ")", sectionFont);
        sectionTitle.setSpacingBefore(12);
        sectionTitle.setSpacingAfter(8);
        doc.add(sectionTitle);

        for (JournalEntry entry : entries) {
            Paragraph header = new Paragraph();
            header.add(new Chunk(moodEmoji(entry.getMood()) + " ", normalFont));
            header.add(new Chunk(entry.getTitle(), boldFont));
            if (entry.getEntryDate() != null) {
                header.add(new Chunk("  —  " + entry.getEntryDate().format(DATE_FMT), smallFont));
            }
            header.setSpacingBefore(8);
            doc.add(header);

            if (entry.getContent() != null && !entry.getContent().isBlank()) {
                String cleanContent = entry.getContent().replaceAll("<[^>]+>", "");
                Paragraph content = new Paragraph(cleanContent, normalFont);
                content.setIndentationLeft(16);
                content.setSpacingAfter(8);
                doc.add(content);
            }
        }

        addDivider(doc);
    }

    private void addFooter(Document doc, Font smallFont) throws DocumentException {
        addDivider(doc);
        Paragraph footer = new Paragraph(
                "Создано в TravelDiary • " + java.time.LocalDate.now().format(DATE_FMT), smallFont);
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setSpacingBefore(8);
        doc.add(footer);
    }

    private void addDivider(Document doc) throws DocumentException {
        PdfPTable divider = new PdfPTable(1);
        divider.setWidthPercentage(100);
        PdfPCell cell = new PdfPCell();
        cell.setBorderWidthTop(0);
        cell.setBorderWidthLeft(0);
        cell.setBorderWidthRight(0);
        cell.setBorderWidthBottom(1);
        cell.setBorderColorBottom(DIVIDER);
        cell.setFixedHeight(1);
        cell.setPaddingTop(8);
        divider.addCell(cell);
        divider.setSpacingAfter(8);
        doc.add(divider);
    }

    private void addTableCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setBorderColor(DIVIDER);
        cell.setBackgroundColor(Color.WHITE);
        table.addCell(cell);
    }

    private String categoryLabel(Place.Category cat) {
        if (cat == null) return "Другое";
        return switch (cat) {
            case ATTRACTION -> "Достопримечательность";
            case RESTAURANT -> "Ресторан";
            case HOTEL -> "Отель";
            case MUSEUM -> "Музей";
            case NATURE -> "Природа";
            case TRANSPORT -> "Транспорт";
            case SHOPPING -> "Шоппинг";
            case ENTERTAINMENT -> "Развлечения";
            case OTHER -> "Другое";
        };
    }

    private String moodEmoji(JournalEntry.Mood mood) {
        if (mood == null) return "";
        return switch (mood) {
            case AMAZING -> "[Потрясающе]";
            case GOOD -> "[Хорошо]";
            case NEUTRAL -> "[Нейтрально]";
            case TIRED -> "[Устал]";
            case BAD -> "[Плохо]";
        };
    }
}
