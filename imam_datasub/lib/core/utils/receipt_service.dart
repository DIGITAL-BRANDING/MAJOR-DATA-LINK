import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:printing/printing.dart';
import 'dart:io';
import '../config/app_config.dart';
import '../utils/formatters.dart';

class ReceiptData {
  const ReceiptData({
    required this.title,
    required this.amount,
    required this.reference,
    required this.date,
    required this.status,
    required this.details, // ordered key-value pairs
    this.balanceAfter,
  });

  final String title;
  final double amount;
  final String reference;
  final DateTime date;
  final String status;
  final List<MapEntry<String, String>> details;
  final double? balanceAfter;
}

class ReceiptService {
  ReceiptService._();

  static const _brandGold = PdfColor.fromInt(0xFFD4AF37);
  static const _brandBronze = PdfColor.fromInt(0xFFC9A227);
  static const _successGreen = PdfColor.fromInt(0xFF10B981);
  static const _neutral500 = PdfColor.fromInt(0xFF8E8E93);
  static const _neutral900 = PdfColor.fromInt(0xFF1C1C1E);

  static Future<Uint8List> generatePdf(ReceiptData data) async {
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a5,
        margin: const pw.EdgeInsets.all(28),
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Header
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'MAJOR DATA-LINK',
                    style: pw.TextStyle(
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                      color: _brandGold,
                    ),
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: pw.BoxDecoration(
                      color: PdfColor.fromInt(0xFFECFDF5),
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Text(
                      data.status.toUpperCase(),
                      style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                        color: _successGreen,
                      ),
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 4),
              pw.Text(
                'Transaction Receipt',
                style: pw.TextStyle(fontSize: 10, color: _neutral500),
              ),

              pw.SizedBox(height: 20),
              pw.Divider(color: PdfColor.fromInt(0xFFE5E5EA)),
              pw.SizedBox(height: 20),

              // Amount
              pw.Text(
                data.title,
                style: pw.TextStyle(fontSize: 12, color: _neutral500),
              ),
              pw.SizedBox(height: 4),
              pw.Text(
                AppFormatters.formatAmount(data.amount),
                style: pw.TextStyle(
                  fontSize: 28,
                  fontWeight: pw.FontWeight.bold,
                  color: _neutral900,
                ),
              ),

              pw.SizedBox(height: 24),

              // Details table
              ...data.details.map(
                (entry) => pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 6),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        entry.key,
                        style: pw.TextStyle(fontSize: 11, color: _neutral500),
                      ),
                      pw.Text(
                        entry.value,
                        style: pw.TextStyle(
                          fontSize: 11,
                          fontWeight: pw.FontWeight.bold,
                          color: _neutral900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              pw.SizedBox(height: 6),
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 6),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Date',
                        style: pw.TextStyle(fontSize: 11, color: _neutral500)),
                    pw.Text(
                      AppFormatters.formatDateTime(data.date),
                      style: pw.TextStyle(
                        fontSize: 11,
                        fontWeight: pw.FontWeight.bold,
                        color: _neutral900,
                      ),
                    ),
                  ],
                ),
              ),
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 6),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Reference',
                        style: pw.TextStyle(fontSize: 11, color: _neutral500)),
                    pw.Text(
                      data.reference,
                      style: pw.TextStyle(
                        fontSize: 11,
                        fontWeight: pw.FontWeight.bold,
                        color: _neutral900,
                      ),
                    ),
                  ],
                ),
              ),

              if (data.balanceAfter != null) ...[
                pw.SizedBox(height: 6),
                pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 6),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Wallet balance',
                          style:
                              pw.TextStyle(fontSize: 11, color: _neutral500)),
                      pw.Text(
                        AppFormatters.formatAmount(data.balanceAfter!),
                        style: pw.TextStyle(
                          fontSize: 11,
                          fontWeight: pw.FontWeight.bold,
                          color: _neutral900,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              pw.Spacer(),
              pw.Divider(color: PdfColor.fromInt(0xFFE5E5EA)),
              pw.SizedBox(height: 12),
              pw.Center(
                child: pw.Text(
                  'Thank you for using MAJOR DATA-LINK',
                  style: pw.TextStyle(fontSize: 10, color: _neutral500),
                ),
              ),
              pw.SizedBox(height: 4),
              pw.Center(
                child: pw.Text(
                  AppConfig.supportEmail,
                  style: pw.TextStyle(fontSize: 9, color: _neutral500),
                ),
              ),
            ],
          );
        },
      ),
    );

    return doc.save();
  }

  static Future<File> savePdf(ReceiptData data) async {
    final bytes = await generatePdf(data);
    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}/receipt_${data.reference}.pdf',
    );
    await file.writeAsBytes(bytes);
    return file;
  }

  static Future<void> shareReceipt(ReceiptData data) async {
    final file = await savePdf(data);
    await Share.shareXFiles(
      [XFile(file.path)],
      subject: '${data.title} Receipt — MAJOR DATA-LINK',
      text:
          '${data.title} of ${AppFormatters.formatAmount(data.amount)} — Ref: ${data.reference}',
    );
  }

  static Future<void> printReceipt(ReceiptData data) async {
    final bytes = await generatePdf(data);
    await Printing.layoutPdf(onLayout: (_) async => bytes);
  }

  static Future<void> downloadReceipt(ReceiptData data) async {
    final bytes = await generatePdf(data);
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/KD_Receipt_${data.reference}.pdf');
    await file.writeAsBytes(bytes);
  }
}

