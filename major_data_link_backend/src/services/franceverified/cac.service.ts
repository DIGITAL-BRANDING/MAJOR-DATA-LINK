import { franceVerifiedPost } from './client.js';

/** Docs: https://www.franceverified.com/api-docs/cac */
export type CacSearchType = 'ALL' | 'BUSINESS_NAME' | 'COMPANY' | 'INCORPORATED_TRUSTEES';

export function searchCac(params: { searchTerm: string; searchType?: CacSearchType; classificationId?: string }) {
  return franceVerifiedPost('/cac/search', {
    searchTerm: params.searchTerm,
    SearchType: params.searchType ?? 'ALL',
    classificationId: params.classificationId ?? ''
  });
}
