import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class KDPinInput extends StatefulWidget {
  const KDPinInput({
    super.key,
    required this.length,
    required this.onCompleted,
    this.onChanged,
    this.obscure = true,
    this.autofocus = true,
    this.hasError = false,
    this.errorShakeKey,
  });

  final int length;
  final void Function(String) onCompleted;
  final void Function(String)? onChanged;
  final bool obscure;
  final bool autofocus;
  final bool hasError;
  final Key? errorShakeKey;

  @override
  State<KDPinInput> createState() => _KDPinInputState();
}

class _KDPinInputState extends State<KDPinInput> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  String _value = '';

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _focusNode = FocusNode();
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void clear() {
    setState(() {
      _value = '';
      _controller.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : widget.length * AppDimensions.pinSize;
        const spacing = AppDimensions.pinSpacing;
        final availableForBoxes = maxWidth - (spacing * (widget.length - 1));
        final boxSize = (availableForBoxes / widget.length)
            .clamp(36.0, AppDimensions.pinSize);

        return GestureDetector(
          onTap: () => _focusNode.requestFocus(),
          child: Stack(
            children: [
              // Hidden text field that handles actual input
              Opacity(
                opacity: 0,
                child: SizedBox(
                  height: 1,
                  width: 1,
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    autofocus: widget.autofocus,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(widget.length),
                    ],
                    onChanged: (v) {
                      setState(() => _value = v);
                      widget.onChanged?.call(v);
                      if (v.length == widget.length) {
                        widget.onCompleted(v);
                      }
                    },
                  ),
                ),
              ),

              // Visual PIN boxes
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate((widget.length * 2) - 1, (rowIndex) {
                  if (rowIndex.isOdd) return SizedBox(width: spacing);

                  final index = rowIndex ~/ 2;
                  final filled = index < _value.length;
                  final isCurrent = index == _value.length;

                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: boxSize,
                    height: boxSize,
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.lightSurfaceVariant,
                      borderRadius:
                          BorderRadius.circular(AppDimensions.radiusMD),
                      border: Border.all(
                        color: widget.hasError
                            ? scheme.error
                            : isCurrent
                                ? scheme.primary
                                : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: Center(
                      child: filled
                          ? (widget.obscure
                              ? Container(
                                  width: 10,
                                  height: 10,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isDark
                                        ? AppColors.neutral100
                                        : AppColors.neutral900,
                                  ),
                                )
                              : Text(
                                  _value[index],
                                  style: TextStyle(
                                    fontSize: boxSize < 44 ? 18 : 22,
                                    fontWeight: FontWeight.w700,
                                    color: isDark
                                        ? AppColors.neutral100
                                        : AppColors.neutral900,
                                  ),
                                ))
                          : null,
                    ),
                  );
                }),
              )
                  .animate(
                    key: widget.errorShakeKey,
                    target: widget.hasError ? 1 : 0,
                  )
                  .shake(hz: 4, curve: Curves.easeInOut, duration: 400.ms),
            ],
          ),
        );
      },
    );
  }
}

// ── OTP input (6-digit) wrapper for the OTP screen ─────────
class KDOtpInput extends StatelessWidget {
  const KDOtpInput({
    super.key,
    required this.onCompleted,
    this.onChanged,
    this.hasError = false,
  });

  final void Function(String) onCompleted;
  final void Function(String)? onChanged;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    return KDPinInput(
      length: AppDimensions.otpLength,
      obscure: false,
      onCompleted: onCompleted,
      onChanged: onChanged,
      hasError: hasError,
    );
  }
}
