/// Compares two version strings like "1.2.3" (ignores any "+buildNumber"
/// suffix, since PackageInfo.version and pubspec.yaml's `version:` field
/// both use "1.0.0+1" - only the part before "+" is a real version number).
///
/// Returns negative if [a] < [b], zero if equal, positive if [a] > [b].
/// Missing/non-numeric segments are treated as 0, so "1.2" vs "1.2.0"
/// compares equal, and a malformed string never throws.
int compareVersions(String a, String b) {
  List<int> parts(String v) {
    final base = v.split('+').first;
    return base.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  }

  final partsA = parts(a);
  final partsB = parts(b);
  final length = partsA.length > partsB.length ? partsA.length : partsB.length;

  for (var i = 0; i < length; i++) {
    final segmentA = i < partsA.length ? partsA[i] : 0;
    final segmentB = i < partsB.length ? partsB[i] : 0;
    if (segmentA != segmentB) return segmentA - segmentB;
  }
  return 0;
}

/// True if the installed [current] version is below [minRequired].
bool isBelowMinimumVersion(String current, String minRequired) {
  return compareVersions(current, minRequired) < 0;
}
