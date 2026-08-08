import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../data/datasources/transactions_remote_datasource.dart';
import '../../domain/entities/transaction_entity.dart';

final transactionsRemoteDataSourceProvider =
    Provider<TransactionsRemoteDataSource>((ref) {
  return TransactionsRemoteDataSourceImpl(ref.read(dioClientProvider));
});

// ── Recent transactions (for home dashboard — first 5) ─────
final recentTransactionsProvider =
    FutureProvider<List<TransactionEntity>>((ref) async {
  try {
    final ds = ref.read(transactionsRemoteDataSourceProvider);
    return await ds.getTransactions(page: 1, limit: 5);
  } catch (_) {
    return [];
  }
});

// ── Filter state for full transaction list screen ─────────
class TransactionFilter {
  const TransactionFilter({
    this.type,
    this.status,
    this.from,
    this.to,
    this.search,
  });

  final String? type;
  final String? status;
  final DateTime? from;
  final DateTime? to;
  final String? search;

  TransactionFilter copyWith({
    String? type,
    String? status,
    DateTime? from,
    DateTime? to,
    String? search,
    bool clearType = false,
    bool clearStatus = false,
    bool clearDates = false,
    bool clearSearch = false,
  }) {
    return TransactionFilter(
      type: clearType ? null : (type ?? this.type),
      status: clearStatus ? null : (status ?? this.status),
      from: clearDates ? null : (from ?? this.from),
      to: clearDates ? null : (to ?? this.to),
      search: clearSearch ? null : (search ?? this.search),
    );
  }
}

final transactionFilterProvider =
    StateProvider<TransactionFilter>((ref) => const TransactionFilter());

// ── Paginated transaction list state ────────────────────────
class TransactionListState {
  const TransactionListState({
    this.transactions = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.page = 1,
    this.error,
  });

  final List<TransactionEntity> transactions;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final String? error;

  TransactionListState copyWith({
    List<TransactionEntity>? transactions,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    String? error,
  }) {
    return TransactionListState(
      transactions: transactions ?? this.transactions,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      page: page ?? this.page,
      error: error,
    );
  }
}

class TransactionListNotifier extends StateNotifier<TransactionListState> {
  TransactionListNotifier(this._ref) : super(const TransactionListState()) {
    loadFirstPage();
  }

  final Ref _ref;
  static const _pageSize = 20;

  Future<void> loadFirstPage() async {
    state = state.copyWith(isLoading: true, error: null);
    final filter = _ref.read(transactionFilterProvider);
    final ds = _ref.read(transactionsRemoteDataSourceProvider);

    try {
      final results = await ds.getTransactions(
        page: 1,
        limit: _pageSize,
        type: filter.type,
        status: filter.status,
        from: filter.from,
        to: filter.to,
        search: filter.search,
      );
      state = TransactionListState(
        transactions: results,
        page: 1,
        hasMore: results.length == _pageSize,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);

    final filter = _ref.read(transactionFilterProvider);
    final ds = _ref.read(transactionsRemoteDataSourceProvider);
    final nextPage = state.page + 1;

    try {
      final results = await ds.getTransactions(
        page: nextPage,
        limit: _pageSize,
        type: filter.type,
        status: filter.status,
        from: filter.from,
        to: filter.to,
        search: filter.search,
      );
      state = state.copyWith(
        transactions: [...state.transactions, ...results],
        page: nextPage,
        hasMore: results.length == _pageSize,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  Future<void> refresh() => loadFirstPage();
}

final transactionListProvider = StateNotifierProvider.autoDispose<
    TransactionListNotifier, TransactionListState>((ref) {
  ref.watch(transactionFilterProvider); // re-create on filter change
  return TransactionListNotifier(ref);
});
