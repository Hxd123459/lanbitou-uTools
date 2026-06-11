import { isUtoolsMode } from '../storage/env'
import * as utoolsGlobalSearch from '../storage/utools/globalSearchRepository'

export async function searchGlobal(params = {}) {
  if (isUtoolsMode()) {
    return utoolsGlobalSearch.globalSearch(params)
  }
  return {
    records: [],
    total: 0,
    pageNo: 1,
    pageSize: 30,
    pages: 1,
    hasMore: false,
  }
}
