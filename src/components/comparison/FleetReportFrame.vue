<script setup lang="ts">
import axios from 'axios';
import { useRoute, useRouter } from 'vue-router';

/**
 * A bot's published live-vs-backtest HTML report(s), embedded.
 *
 * The dashboard gateway lists a bot's current bundle (`GET /api/reports/<slug>`) and
 * serves only files named in its manifest. Used by the Reports page and by the
 * Compare "Report" tab, which pass the bot's gateway slug.
 */
const props = defineProps<{ slug: string }>();

interface ReportFile {
  name: string;
  title: string;
  url: string;
  /** File size; reports run from a few hundred KB to 70 MB of embedded charts. */
  bytes?: number;
}

/**
 * Reports above this size open on request. An iframe runs on the page's own thread, so
 * a 70 MB report with dozens of charts would freeze the whole dashboard on load.
 */
const AUTO_LOAD_LIMIT_BYTES = 4 * 1024 * 1024;

interface ReportListing {
  slug: string;
  deployment: string;
  report_date: string | null;
  run_id: string | null;
  files: ReportFile[];
}

const route = useRoute();
const router = useRouter();
const listing = ref<ReportListing | null>(null);
const error = ref('');
const loading = ref(false);

const confirmed = ref<Set<string>>(new Set());

const needsConfirmation = computed(() => {
  const file = selectedFile.value;
  return !!file && (file.bytes ?? 0) > AUTO_LOAD_LIMIT_BYTES && !confirmed.value.has(file.name);
});

function sizeLabel(bytes?: number): string {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
}

const selectedFile = computed(() => {
  const files = listing.value?.files ?? [];
  const requested = typeof route.query.file === 'string' ? route.query.file : '';
  return files.find((file) => file.name === requested) ?? files[0];
});

function reportDate(value: string | null): string {
  return value && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : (value ?? '');
}

function selectFile(name: string) {
  router.replace({ path: route.path, query: { ...route.query, file: name } });
}

async function load(slug: string) {
  listing.value = null;
  error.value = '';
  if (!slug) return;
  loading.value = true;
  try {
    const { data } = await axios.get<ReportListing>(`/api/reports/${encodeURIComponent(slug)}`, {
      withCredentials: true,
    });
    listing.value = data;
  } catch (e) {
    error.value =
      axios.isAxiosError(e) && e.response?.status === 404
        ? 'This bot has no published live-vs-backtest report bundle yet.'
        : 'Could not load the report list.';
  } finally {
    loading.value = false;
  }
}

watch(() => props.slug, load, { immediate: true });
</script>

<template>
  <div class="flex flex-col gap-2 min-h-0">
    <div v-if="listing" class="text-sm text-surface-500 text-start">
      Report date {{ reportDate(listing.report_date) }} · run {{ listing.run_id }}
      <a
        v-if="selectedFile"
        :href="selectedFile.url"
        target="_blank"
        rel="noopener"
        class="text-primary underline ms-3"
      >
        Open in new tab
      </a>
    </div>
    <div
      v-if="listing && listing.files.length > 1"
      class="flex flex-wrap gap-1"
      data-testid="report-file-tabs"
    >
      <UButton
        v-for="file in listing.files"
        :key="file.name"
        size="xs"
        :color="file.name === selectedFile?.name ? 'primary' : 'neutral'"
        :variant="file.name === selectedFile?.name ? 'solid' : 'outline'"
        @click="selectFile(file.name)"
      >
        {{ file.title }}
      </UButton>
    </div>
    <UAlert v-if="error" color="warning" class="text-start" :title="error" />
    <div v-else-if="loading" class="text-surface-500 text-sm text-start">Loading report…</div>
    <UAlert
      v-else-if="selectedFile && needsConfirmation"
      color="info"
      class="text-start"
      data-testid="report-load-prompt"
      :title="`This report is ${sizeLabel(selectedFile.bytes)}`"
      description="It embeds many charts and can take several seconds to open. Open it here, or in its own tab."
    >
      <template #actions>
        <UButton size="sm" @click="confirmed = new Set([...confirmed, selectedFile.name])">
          Load report
        </UButton>
        <a
          :href="selectedFile.url"
          target="_blank"
          rel="noopener"
          class="text-primary underline ms-2"
        >
          Open in new tab
        </a>
      </template>
    </UAlert>
    <iframe
      v-else-if="selectedFile"
      :key="selectedFile.url"
      :src="selectedFile.url"
      :title="`Report – ${selectedFile.title}`"
      class="w-full min-h-[75vh] rounded-md border border-surface-300 bg-white"
      data-testid="report-frame"
    />
  </div>
</template>
