import 'package:equatable/equatable.dart';

class BannerEntity extends Equatable {
  const BannerEntity({
    required this.id,
    required this.imageUrl,
    this.title,
    this.actionUrl,
    this.actionType, // 'route' | 'external' | 'none'
  });

  final String id;
  final String imageUrl;
  final String? title;
  final String? actionUrl;
  final String? actionType;

  factory BannerEntity.fromJson(Map<String, dynamic> json) {
    return BannerEntity(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? json['image']?.toString() ?? '',
      title: json['title']?.toString(),
      actionUrl: json['action_url']?.toString() ?? json['link']?.toString(),
      actionType: json['action_type']?.toString() ?? 'none',
    );
  }

  @override
  List<Object?> get props => [id, imageUrl, title, actionUrl, actionType];
}
