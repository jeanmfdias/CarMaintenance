import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useVehiclesStore } from '@/stores/vehicles.store'

/**
 * Resolve a bearer-gated photo path (e.g. `/uploads/<u>/<v>.jpg`) into a
 * displayable `blob:` URL, and revoke it when the source changes or the
 * component unmounts. Without this, long-lived list pages leak object URLs.
 *
 * Pass either a ref or a static string. Returns a `Ref<string | null>` you
 * can bind to `<v-img :src>` etc.
 */
export function useObjectUrl(source: Ref<string | null | undefined> | string | null | undefined) {
  const url = ref<string | null>(null)
  const store = useVehiclesStore()

  function revoke() {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = null
    }
  }

  async function load(path: string | null | undefined) {
    revoke()
    if (!path) return
    try {
      url.value = await store.getPhotoUrl(path)
    } catch {
      // photo unavailable — leave url null so the caller can show a placeholder
      url.value = null
    }
  }

  if (typeof source === 'object' && source !== null && 'value' in source) {
    watch(
      source,
      (next) => {
        void load(next)
      },
      { immediate: true },
    )
  } else {
    void load(source)
  }

  onUnmounted(revoke)

  return url
}
