import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class KDTextField extends StatefulWidget {
  const KDTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helper,
    this.prefix,
    this.prefixIcon,
    this.suffix,
    this.suffixIcon,
    this.onSuffixTap,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.inputFormatters,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.readOnly = false,
    this.obscureText = false,
    this.autofocus = false,
    this.enabled = true,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.focusNode,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.none,
    this.initialValue,
    this.borderRadius = AppDimensions.radiusMD,
    this.fillColor,
    this.contentPadding,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helper;
  final Widget? prefix;
  final IconData? prefixIcon;
  final Widget? suffix;
  final IconData? suffixIcon;
  final VoidCallback? onSuffixTap;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final VoidCallback? onTap;
  final bool readOnly;
  final bool obscureText;
  final bool autofocus;
  final bool enabled;
  final int maxLines;
  final int? minLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;
  final String? initialValue;
  final double borderRadius;
  final Color? fillColor;
  final EdgeInsets? contentPadding;

  @override
  State<KDTextField> createState() => _KDTextFieldState();
}

class _KDTextFieldState extends State<KDTextField> {
  late bool _obscured;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    final defaultFill = isDark ? AppColors.darkSurfaceVariant : AppColors.lightSurfaceVariant;

    return TextFormField(
      controller: widget.controller,
      initialValue: widget.initialValue,
      obscureText: _obscured,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      inputFormatters: widget.inputFormatters,
      validator: widget.validator,
      onChanged: widget.onChanged,
      onFieldSubmitted: widget.onSubmitted,
      onTap: widget.onTap,
      readOnly: widget.readOnly,
      autofocus: widget.autofocus,
      enabled: widget.enabled,
      maxLines: widget.obscureText ? 1 : widget.maxLines,
      minLines: widget.minLines,
      maxLength: widget.maxLength,
      focusNode: widget.focusNode,
      autofillHints: widget.autofillHints,
      textCapitalization: widget.textCapitalization,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: isDark ? AppColors.neutral100 : AppColors.neutral900,
          ),
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        helperText: widget.helper,
        helperMaxLines: 2,
        fillColor: widget.fillColor ?? defaultFill,
        filled: true,
        contentPadding: widget.contentPadding ??
            EdgeInsets.symmetric(
              horizontal: AppDimensions.spaceMD,
              vertical: widget.maxLines > 1 ? AppDimensions.spaceMD : 0,
            ),
        counterText: '', // hide default counter
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(
            color: isDark ? AppColors.darkDivider : AppColors.neutral200,
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(color: scheme.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(
            color: isDark ? AppColors.neutral800 : AppColors.neutral200,
          ),
        ),
        prefixIcon: widget.prefixIcon != null
            ? Icon(
                widget.prefixIcon,
                size: AppDimensions.iconMD,
                color: isDark ? AppColors.neutral400 : AppColors.neutral500,
              )
            : widget.prefix,
        suffixIcon: _buildSuffix(isDark),
      ),
    );
  }

  Widget? _buildSuffix(bool isDark) {
    final iconColor = isDark ? AppColors.neutral400 : AppColors.neutral500;

    // Password visibility toggle
    if (widget.obscureText) {
      return IconButton(
        icon: Icon(
          _obscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          size: AppDimensions.iconMD,
          color: iconColor,
        ),
        onPressed: () => setState(() => _obscured = !_obscured),
      );
    }

    // Custom suffix icon
    if (widget.suffixIcon != null) {
      return IconButton(
        icon: Icon(widget.suffixIcon, size: AppDimensions.iconMD, color: iconColor),
        onPressed: widget.onSuffixTap,
      );
    }

    return widget.suffix;
  }
}

// ── Phone field ───────────────────────────────────────────
class KDPhoneField extends StatelessWidget {
  const KDPhoneField({
    super.key,
    required this.controller,
    this.validator,
    this.onChanged,
    this.label = 'Phone number',
    this.focusNode,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final String label;
  final FocusNode? focusNode;
  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    return KDTextField(
      controller: controller,
      label: label,
      hint: '08012345678',
      prefixIcon: Icons.phone_outlined,
      keyboardType: TextInputType.phone,
      textInputAction: textInputAction,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(11),
      ],
      autofillHints: const [AutofillHints.telephoneNumber],
      validator: validator,
      onChanged: onChanged,
      focusNode: focusNode,
    );
  }
}

// ── Amount field ──────────────────────────────────────────
class KDAmountField extends StatelessWidget {
  const KDAmountField({
    super.key,
    required this.controller,
    this.validator,
    this.onChanged,
    this.label = 'Amount (₦)',
    this.hint = '0.00',
    this.focusNode,
    this.textInputAction = TextInputAction.done,
  });

  final TextEditingController controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final String label;
  final String hint;
  final FocusNode? focusNode;
  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    return KDTextField(
      controller: controller,
      label: label,
      hint: hint,
      prefix: const Padding(
        padding: EdgeInsets.only(left: 16, right: 8),
        child: Text('₦', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textInputAction: textInputAction,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
      ],
      validator: validator,
      onChanged: onChanged,
      focusNode: focusNode,
    );
  }
}

// ── Search field ──────────────────────────────────────────
class KDSearchField extends StatelessWidget {
  const KDSearchField({
    super.key,
    required this.controller,
    this.hint = 'Search...',
    this.onChanged,
    this.onClear,
    this.focusNode,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final String hint;
  final void Function(String)? onChanged;
  final VoidCallback? onClear;
  final FocusNode? focusNode;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return KDTextField(
      controller: controller,
      hint: hint,
      prefixIcon: Icons.search_rounded,
      suffixIcon: Icons.close_rounded,
      onSuffixTap: () {
        controller.clear();
        onClear?.call();
      },
      keyboardType: TextInputType.text,
      textInputAction: TextInputAction.search,
      onChanged: onChanged,
      focusNode: focusNode,
      autofocus: autofocus,
      fillColor: isDark ? AppColors.darkSurface : AppColors.lightSurface,
      borderRadius: AppDimensions.radiusFull,
    );
  }
}
