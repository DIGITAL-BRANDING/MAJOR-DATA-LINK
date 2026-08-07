import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../features/home/domain/entities/banner_entity.dart';

class BannerSlider extends StatefulWidget {
  const BannerSlider({
    super.key,
    required this.banners,
    this.onBannerTap,
  });

  final List<BannerEntity> banners;
  final void Function(BannerEntity)? onBannerTap;

  @override
  State<BannerSlider> createState() => _BannerSliderState();
}

class _BannerSliderState extends State<BannerSlider> {
  final CarouselSliderController _controller = CarouselSliderController();
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        CarouselSlider.builder(
          carouselController: _controller,
          itemCount: widget.banners.length,
          itemBuilder: (context, index, realIndex) {
            final banner = widget.banners[index];
            return GestureDetector(
              onTap: () => widget.onBannerTap?.call(banner),
              child: Container(
                margin: const EdgeInsets.symmetric(
                  horizontal: AppDimensions.screenPaddingH,
                ),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius:
                      BorderRadius.circular(AppDimensions.bannerRadius),
                ),
                child: CachedNetworkImage(
                  imageUrl: banner.imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (_, __) => Container(
                    color: AppColors.neutral100,
                  ),
                  errorWidget: (_, __, ___) => Container(
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                    ),
                    child: const Center(
                      child: Icon(Icons.image_outlined,
                          color: Colors.white54, size: 32),
                    ),
                  ),
                ),
              ),
            );
          },
          options: CarouselOptions(
            height: AppDimensions.bannerHeight,
            viewportFraction: 0.92,
            autoPlay: widget.banners.length > 1,
            autoPlayInterval: const Duration(seconds: 5),
            autoPlayAnimationDuration: const Duration(milliseconds: 600),
            enlargeCenterPage: true,
            enlargeFactor: 0.08,
            onPageChanged: (index, _) =>
                setState(() => _currentIndex = index),
          ),
        ),
        if (widget.banners.length > 1) ...[
          const SizedBox(height: 10),
          AnimatedSmoothIndicator(
            activeIndex: _currentIndex,
            count: widget.banners.length,
            effect: ExpandingDotsEffect(
              dotHeight: 6,
              dotWidth: 6,
              activeDotColor: Theme.of(context).colorScheme.primary,
              dotColor: AppColors.neutral200,
            ),
          ),
        ],
      ],
    );
  }
}
