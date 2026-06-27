import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createSedimentTemplate,
  deleteSedimentTemplate,
  loadSedimentTemplates,
  subscribeSedimentTemplates,
  updateSedimentTemplate,
} from '../storage/utools/sedimentTemplates'

export function useSedimentTemplates() {
  const templates = ref(loadSedimentTemplates())

  const refresh = () => {
    templates.value = loadSedimentTemplates()
  }

  onMounted(() => {
    const unsubscribe = subscribeSedimentTemplates(refresh)
    onBeforeUnmount(unsubscribe)
  })

  return {
    templates,
    refresh,
    createSedimentTemplate,
    updateSedimentTemplate,
    deleteSedimentTemplate,
  }
}
