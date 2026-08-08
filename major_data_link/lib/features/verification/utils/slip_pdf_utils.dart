import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

/// Techhubltd's slip endpoints already return a finished PDF (`pdf_base64`)
/// — unlike [ReceiptService], there's nothing to render, just bytes to save,
/// share or print.
class SlipPdfUtils {
  SlipPdfUtils._();

  static Uint8List decode(String pdfBase64) => base64Decode(pdfBase64);

  static Future<File> save(String pdfBase64, String reference) async {
    final bytes = decode(pdfBase64);
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/NIN_BVN_Slip_$reference.pdf');
    await file.writeAsBytes(bytes);
    return file;
  }

  static Future<void> share(String pdfBase64, String reference) async {
    final bytes = decode(pdfBase64);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/slip_$reference.pdf');
    await file.writeAsBytes(bytes);
    await Share.shareXFiles(
      [XFile(file.path)],
      subject: 'Verification Slip — $reference',
    );
  }

  static Future<void> print(String pdfBase64) async {
    final bytes = decode(pdfBase64);
    await Printing.layoutPdf(onLayout: (_) async => bytes);
  }
}
